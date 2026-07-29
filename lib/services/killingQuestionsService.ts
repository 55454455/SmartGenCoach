import Anthropic from "@anthropic-ai/sdk";
import type { AnswerChoice, Question, SkillScore, TargetedQuestion } from "@/lib/types";
import type { ExamType } from "@/lib/types";
import { getReadinessReport } from "./readinessService";
import { questionHasReasoningLeak } from "./aiTextSafety";
import { describeAnthropicError } from "./anthropicErrors";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface KillingQuestionsResult {
  unlocked: boolean;
  readinessScore: number;
  threshold: number;
  targeted: TargetedQuestion[];
}

interface GeneratedQuestion {
  prompt: string;
  passage?: string;
  choices: { text: string }[];
  correctChoiceIndex: number;
  explanation: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

interface GenerateResult {
  bySkill: { skillId: string; questions: GeneratedQuestion[] }[];
}

const GENERATE_TOOL = {
  name: "generate_practice_questions",
  description: "Generate fresh, never-seen multiple-choice practice questions targeting each specified weak skill.",
  input_schema: {
    type: "object" as const,
    properties: {
      bySkill: {
        type: "array",
        items: {
          type: "object",
          properties: {
            skillId: { type: "string", description: "Echo back the exact skillId this batch of questions targets" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
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
                    minItems: 2,
                  },
                  correctChoiceIndex: { type: "integer" },
                  explanation: {
                    type: "string",
                    description:
                      "A clear, final explanation of why the correct answer is correct. Present only your finished " +
                      "reasoning — do not show scratch work, do not second-guess or revise your answer mid-" +
                      "explanation, and do not include phrases like 'wait', 'let me re-examine', or 'actually' that " +
                      "reveal you changed your mind. Work it out silently first, then write only the clean final " +
                      "explanation, and make sure it is fully consistent with correctChoiceIndex.",
                  },
                  difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
                },
                required: ["prompt", "choices", "correctChoiceIndex", "explanation", "difficulty"],
              },
            },
          },
          required: ["skillId", "questions"],
        },
      },
    },
    required: ["bySkill"],
  },
};

function isValidGenerateResult(input: unknown): input is GenerateResult {
  const candidate = input as Partial<GenerateResult> | null | undefined;
  if (!candidate || !Array.isArray(candidate.bySkill)) return false;
  return candidate.bySkill.every(
    (entry) =>
      typeof entry?.skillId === "string" &&
      Array.isArray(entry?.questions) &&
      entry.questions.every((q) => !questionHasReasoningLeak(q)),
  );
}

async function generateQuestionsForSkills(
  examType: ExamType,
  skills: { skill: SkillScore; missed: number; count: number }[],
): Promise<GenerateResult> {
  const skillBrief = skills
    .map(
      ({ skill, missed, count }) =>
        `- skillId: "${skill.skillId}", skillName: "${skill.skillName}", domain: "${skill.domain}", ` +
        `missed ${missed}/${skill.attempted} recently — generate ${count} fresh question(s) for this skill.`,
    )
    .join("\n");

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        tools: [GENERATE_TOOL],
        tool_choice: { type: "tool", name: "generate_practice_questions" },
        messages: [
          {
            role: "user",
            content:
              `Generate targeted ${examType} practice questions for a student's weakest skills. For each skill below, ` +
              `write brand-new multiple-choice questions (never copied from a known test) that isolate exactly that ` +
              `sub-skill, at a difficulty appropriate for someone who has been missing questions on it. Work out each ` +
              `question and its answer choices carefully yourself first, but keep that work private: report only the ` +
              `final, clean question, answer choices, and explanation — never include hedging, self-correction, or ` +
              `visible scratch work like "wait" or "..." in any field, and double-check that correctChoiceIndex and the ` +
              `explanation agree with each other before answering.\n\n${skillBrief}`,
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
      lastError = new Error("Could not generate targeted practice questions.");
      continue;
    }
    if (!isValidGenerateResult(toolUse.input)) {
      lastError = new Error("The AI returned an invalid or unpolished response while generating practice questions.");
      continue;
    }
    return toolUse.input;
  }
  throw lastError instanceof Error ? lastError : new Error("Could not generate targeted practice questions.");
}

export async function getKillingQuestions(examType: ExamType): Promise<KillingQuestionsResult> {
  const report = await getReadinessReport(examType);
  if (!report.unlocked) {
    return { unlocked: false, readinessScore: report.readinessScore, threshold: report.threshold, targeted: [] };
  }

  const weakSkills = report.weakestSkills
    .map((skill) => ({ skill, missed: skill.attempted - skill.correct }))
    .filter(({ missed }) => missed > 0)
    .map(({ skill, missed }) => ({ skill, missed, count: 2 }));

  if (weakSkills.length === 0) {
    return { unlocked: true, readinessScore: report.readinessScore, threshold: report.threshold, targeted: [] };
  }

  const generated = await generateQuestionsForSkills(examType, weakSkills);
  const bySkillId = new Map(generated.bySkill.map((entry) => [entry.skillId, entry.questions]));

  const targeted: TargetedQuestion[] = [];
  for (const { skill, missed } of weakSkills) {
    const questions = bySkillId.get(skill.skillId) ?? [];
    questions.forEach((q, i) => {
      const questionId = `kq-${skill.skillId}-${Date.now()}-${i}`;
      const choices: AnswerChoice[] = q.choices.map((c, j) => ({ id: `${questionId}-c${j}`, text: c.text }));
      const correctChoiceId = choices[q.correctChoiceIndex]?.id ?? choices[0].id;
      const question: Question = {
        id: questionId,
        examType,
        domain: skill.domain,
        skillId: skill.skillId,
        skillName: skill.skillName,
        prompt: q.prompt,
        passage: q.passage,
        choices,
        correctChoiceId,
        difficulty: q.difficulty,
        explanation: q.explanation,
      };
      targeted.push({ question, reason: `You missed ${missed}/${skill.attempted} questions on ${skill.skillName}` });
    });
  }

  return { unlocked: true, readinessScore: report.readinessScore, threshold: report.threshold, targeted };
}
