import Anthropic from "@anthropic-ai/sdk";
import type { AnswerChoice, Difficulty, ExamType, Question, SkillDomain } from "@/lib/types";
import { questionHasReasoningLeak } from "./aiTextSafety";
import { describeAnthropicError } from "./anthropicErrors";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface SkillSlot {
  skillId: string;
  skillName: string;
}

interface GeneratedQuestion {
  skillId: string;
  prompt: string;
  passage?: string;
  choices: { text: string }[];
  correctChoiceIndex: number;
  explanation: string;
  difficulty: Difficulty;
  tip?: string;
}

interface GenerateResult {
  questions: GeneratedQuestion[];
}

const GENERATE_TOOL = {
  name: "generate_exam_questions",
  description: "Generate fresh, never-seen multiple-choice exam questions, one per requested skill slot, at the requested difficulty.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            skillId: { type: "string", description: "Echo back the exact skillId this question targets" },
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
            },
            correctChoiceIndex: { type: "integer" },
            explanation: {
              type: "string",
              description:
                "A clear, final explanation of why the correct answer is correct. Present only your finished " +
                "reasoning — do not show scratch work, do not second-guess or revise your answer mid-explanation, " +
                "and do not include phrases like 'wait', 'let me re-examine', or 'actually' that reveal you changed " +
                "your mind. Work it out silently first, then write only the clean final explanation, and make sure " +
                "it is fully consistent with correctChoiceIndex.",
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
          required: ["skillId", "prompt", "choices", "correctChoiceIndex", "explanation", "difficulty"],
        },
      },
    },
    required: ["questions"],
  },
};

function isValidGenerateResult(input: unknown, expectedCount: number): input is GenerateResult {
  const candidate = input as Partial<GenerateResult> | null | undefined;
  if (!candidate || !Array.isArray(candidate.questions) || candidate.questions.length !== expectedCount) return false;
  return candidate.questions.every(
    (q) =>
      typeof q?.skillId === "string" &&
      typeof q?.prompt === "string" &&
      Array.isArray(q?.choices) &&
      q.choices.length >= 2 &&
      typeof q?.correctChoiceIndex === "number" &&
      q.correctChoiceIndex >= 0 &&
      q.correctChoiceIndex < q.choices.length &&
      !questionHasReasoningLeak(q),
  );
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
}): Promise<Question[]> {
  const { examType, domain, slots, difficulty, idPrefix } = params;
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

  // More retries here than the single-batch Killing Questions generator: a whole batch of
  // quantitative questions is more likely to trip the leak guard on at least one item, so give it
  // more chances to land a fully clean batch before giving up.
  const maxAttempts = isQuantitative ? 5 : 3;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        tools: [GENERATE_TOOL],
        tool_choice: { type: "tool", name: "generate_exam_questions" },
        messages: [
          {
            role: "user",
            content:
              `Generate ${slots.length} brand-new, never-seen ${examType} ${domain} multiple-choice question(s), one ` +
              `for each numbered skill slot below (each needs exactly 4 answer choices). ${difficultyLine} ${constructionLine}${dsatMathContextLine}` +
              `Work out each question and its answer choices carefully yourself first, but keep that work private: ` +
              `report only the final, clean question, answer choices, and explanation — never include hedging, self-` +
              `correction, or visible scratch work like "wait", "let me recheck", or "..." in any field, and double-check ` +
              `that correctChoiceIndex and the explanation agree with each other before answering.\n\n${slotBrief}`,
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
      const choices: AnswerChoice[] = q.choices.map((c, j) => ({ id: `${questionId}-c${j}`, text: c.text }));
      const correctChoiceId = choices[q.correctChoiceIndex]?.id ?? choices[0].id;
      const slot = slots[i];
      return {
        id: questionId,
        examType,
        domain,
        skillId: slot.skillId,
        skillName: slot.skillName,
        prompt: q.prompt,
        passage: q.passage,
        choices,
        correctChoiceId,
        difficulty: q.difficulty,
        explanation: q.explanation,
        category: `${examType} · ${domain}`,
        tip: q.tip,
      };
    });
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not generate ${domain} questions.`);
}
