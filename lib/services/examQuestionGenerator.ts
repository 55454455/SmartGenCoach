import Anthropic from "@anthropic-ai/sdk";
import type { AnswerChoice, Difficulty, ExamType, Question, QuestionFormat, SkillDomain } from "@/lib/types";
import { questionHasReasoningLeak } from "./aiTextSafety";
import { describeAnthropicError } from "./anthropicErrors";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface SkillSlot {
  skillId: string;
  skillName: string;
}

interface GeneratedQuestion {
  skillId: string;
  format?: QuestionFormat;
  prompt: string;
  passage?: string;
  choices?: { text: string }[];
  correctChoiceIndex?: number;
  acceptedAnswers?: string[];
  explanation: string;
  difficulty: Difficulty;
  tip?: string;
}

interface GenerateResult {
  questions: GeneratedQuestion[];
}

function buildGenerateTool(allowGridIn: boolean) {
  return {
    name: "generate_exam_questions",
    description: "Generate fresh, never-seen exam questions, one per requested skill slot, at the requested difficulty.",
    input_schema: {
      type: "object" as const,
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              skillId: { type: "string", description: "Echo back the exact skillId this question targets" },
              ...(allowGridIn
                ? {
                    format: {
                      type: "string",
                      enum: ["multiple-choice", "grid-in"],
                      description:
                        "\"grid-in\" means a free numeric-entry question with no answer choices. About 1 in 4 " +
                        "questions overall should be \"grid-in\" (spread across the set, not clustered); the rest " +
                        "\"multiple-choice\".",
                    },
                  }
                : {}),
              prompt: { type: "string" },
              passage: { type: "string", description: "A short reading passage or context, if the question needs one" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description:
                        "The final, clean text of this answer choice only — a single finished value or option, " +
                        "never your scratch work, alternate attempts, or phrases like 'wait' or '...' showing " +
                        "you changed your mind partway through.",
                    },
                  },
                  required: ["text"],
                },
                minItems: 4,
                maxItems: 4,
                description: allowGridIn
                  ? "Required and exactly 4 items when format is \"multiple-choice\". Omit entirely when format is \"grid-in\"."
                  : undefined,
              },
              correctChoiceIndex: {
                type: "integer",
                description: allowGridIn ? "Required when format is \"multiple-choice\". Omit when format is \"grid-in\"." : undefined,
              },
              ...(allowGridIn
                ? {
                    acceptedAnswers: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Required when format is \"grid-in\", omit otherwise: every distinct correct numeric value as a " +
                        "plain string (e.g. [\"3/4\"] or [\"2\", \"-2\"] if two different values both solve it). List " +
                        "just the canonical value per answer — a fraction or a decimal, whichever is most natural — " +
                        "the equivalence check handles other formats itself.",
                    },
                  }
                : {}),
              explanation: {
                type: "string",
                description:
                  "A clear, final explanation of why the correct answer is correct. Present only your finished " +
                  "reasoning — do not show scratch work, do not second-guess or revise your answer mid-explanation, " +
                  "and do not include phrases like 'wait', 'let me re-examine', or 'actually' that reveal you changed " +
                  "your mind. Work it out silently first, then write only the clean final explanation, and make sure " +
                  "it is fully consistent with the correct answer.",
              },
              difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
              tip: {
                type: "string",
                description:
                  "One short, punchy sentence naming the single best general pattern, mental shortcut, or reading " +
                  "skill for solving this *category* of question — not a recap of this specific question's answer. " +
                  "Written so it would still help on a different question of the same skill. Used by the Let's Play " +
                  "multiplayer mode's 'Tips & Tricks' reveal card.",
              },
            },
            required: allowGridIn
              ? ["skillId", "format", "prompt", "explanation", "difficulty"]
              : ["skillId", "prompt", "choices", "correctChoiceIndex", "explanation", "difficulty"],
          },
        },
      },
      required: ["questions"],
    },
  };
}

function isValidGenerateResult(input: unknown, expectedCount: number): input is GenerateResult {
  const candidate = input as Partial<GenerateResult> | null | undefined;
  if (!candidate || !Array.isArray(candidate.questions) || candidate.questions.length !== expectedCount) return false;
  return candidate.questions.every((q) => {
    if (typeof q?.skillId !== "string" || typeof q?.prompt !== "string" || questionHasReasoningLeak(q)) return false;
    if (q.format === "grid-in") {
      return Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0 && q.acceptedAnswers.every((a) => typeof a === "string" && a.trim() !== "");
    }
    return (
      Array.isArray(q.choices) &&
      q.choices.length >= 2 &&
      typeof q.correctChoiceIndex === "number" &&
      q.correctChoiceIndex >= 0 &&
      q.correctChoiceIndex < q.choices.length
    );
  });
}

// PHASE2: once this moves behind a real Multi-Agent orchestration layer (Math Agent, English
// Agent, etc.), this becomes the shared low-level "write me N questions" tool the subject agents
// call — for now it's the one real Claude call backing both Full Exam module assembly
// (examService.ts) and Skill Practice, so every standard exam mode gets genuinely fresh,
// never-seen questions instead of the static mock bank.
export async function generateExamQuestions(params: {
  examType: ExamType;
  domain: SkillDomain;
  slots: SkillSlot[];
  difficulty: Difficulty | "Mixed";
  idPrefix: string;
  // Digital SAT Math only, per College Board's real test spec (~25% grid-in / "student-produced
  // response" questions). Every other caller leaves this off and gets pure multiple-choice, exactly
  // as before.
  allowGridIn?: boolean;
}): Promise<Question[]> {
  const { examType, domain, slots, difficulty, idPrefix, allowGridIn = false } = params;
  if (slots.length === 0) return [];

  const difficultyLine =
    difficulty === "Mixed"
      ? "Use a natural mix of Easy, Medium, and Hard difficulty across the set."
      : `Target difficulty: ${difficulty} — every question should be solvable but appropriately challenging for that level.`;

  const slotBrief = slots.map((s, i) => `${i + 1}. skillId: "${s.skillId}", skillName: "${s.skillName}"`).join("\n");

  // Quantitative domains (math/calculus-style arithmetic) are where the model most often does its
  // arithmetic live inside the explanation text and visibly stumbles ("wait, that's not clean...")
  // — which the reasoning-leak guard correctly rejects, but that costs a retry every time it
  // happens. Constructing backward from a chosen clean answer is far more reliable than solving
  // forward and hoping the numbers come out clean, so ask for that explicitly on those domains.
  const isQuantitative = domain === "Math" || domain === "Calculus";
  const constructionLine = isQuantitative
    ? "For each question, work backward: first pick the correct final numeric answer, then design the equation/problem " +
      "around it so the arithmetic comes out exactly clean — don't solve forward and hope for a tidy number. If your " +
      "private check ever reveals the arithmetic doesn't match, silently discard that attempt and construct a fresh " +
      "question from scratch; never mention the discarded attempt or the mismatch anywhere in your answer. "
    : "";

  // College Board's Digital SAT spec calls for roughly 30% of Math questions to be "in context"
  // (real-world word problems) rather than bare symbolic/computational ones.
  const dsatMathContextLine =
    examType === "DSAT" && domain === "Math"
      ? "About 3 in 10 of these should be an \"in context\" word problem grounded in a realistic scenario " +
        "(science, business, everyday life, etc.) rather than a bare equation to solve; the rest can be direct " +
        "symbolic/computational questions. "
      : "";

  const formatLine = allowGridIn
    ? "About 1 in 4 should be format \"grid-in\" (spread across the set, not all at the start or end) — a free " +
      "numeric-entry question with no answer choices, testing the same skill just as validly as a multiple-choice " +
      "one would. The rest should be \"multiple-choice\" with exactly 4 choices as usual. "
    : "";

  // More retries here than the single-batch Killing Questions generator: a whole batch of
  // quantitative questions is more likely to trip the leak guard on at least one item, so give it
  // more chances to land a fully clean batch before giving up.
  const maxAttempts = isQuantitative ? 5 : 3;

  const generateTool = buildGenerateTool(allowGridIn);

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        tools: [generateTool],
        tool_choice: { type: "tool", name: "generate_exam_questions" },
        messages: [
          {
            role: "user",
            content:
              `Generate ${slots.length} brand-new, never-seen ${examType} ${domain} question(s), one for each ` +
              `numbered skill slot below. ${difficultyLine} ${constructionLine}${dsatMathContextLine}${formatLine}` +
              `Work out each question and its answer carefully yourself first, but keep that work private: report ` +
              `only the final, clean question, answer, and explanation — never include hedging, self-correction, or ` +
              `visible scratch work like "wait", "let me recheck", or "..." in any field, and double-check that the ` +
              `correct answer and the explanation agree with each other before answering.\n\n${slotBrief}`,
          },
        ],
      });
    } catch (err) {
      const { message, retryable } = describeAnthropicError(err);
      lastError = new Error(message);
      if (!retryable) break;
      continue;
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.error(`[examQuestionGenerator] no tool_use block for ${examType} ${domain} (attempt ${attempt + 1}/${maxAttempts})`);
      lastError = new Error(`Could not generate ${domain} questions.`);
      continue;
    }
    if (!isValidGenerateResult(toolUse.input, slots.length)) {
      console.error(
        `[examQuestionGenerator] invalid/unpolished response for ${examType} ${domain} (attempt ${attempt + 1}/${maxAttempts}):`,
        JSON.stringify(toolUse.input).slice(0, 2000),
      );
      lastError = new Error(`The AI returned an invalid or unpolished response while generating ${domain} questions.`);
      continue;
    }

    return toolUse.input.questions.map((q, i): Question => {
      const questionId = `${idPrefix}-${i}`;
      const slot = slots[i];
      const base = {
        id: questionId,
        examType,
        domain,
        skillId: slot.skillId,
        skillName: slot.skillName,
        prompt: q.prompt,
        passage: q.passage,
        difficulty: q.difficulty,
        explanation: q.explanation,
        category: `${examType} · ${domain}`,
        tip: q.tip,
      };

      if (q.format === "grid-in") {
        return { ...base, format: "grid-in", choices: [], correctChoiceId: "", acceptedAnswers: q.acceptedAnswers ?? [] };
      }

      const choices: AnswerChoice[] = (q.choices ?? []).map((c, j) => ({ id: `${questionId}-c${j}`, text: c.text }));
      const correctChoiceId = choices[q.correctChoiceIndex ?? 0]?.id ?? choices[0].id;
      return { ...base, format: "multiple-choice", choices, correctChoiceId };
    });
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not generate ${domain} questions.`);
}
