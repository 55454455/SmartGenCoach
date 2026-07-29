import Anthropic from "@anthropic-ai/sdk";
import { SMART_STUDIO_TESTS } from "@/lib/mockData";
import type { AnswerChoice, SmartStudioGradedResult, SmartStudioQuestion, SmartStudioTest } from "@/lib/types";
import { simulateLatency } from "./simulateLatency";
import { containsReasoningLeak } from "./aiTextSafety";
import { describeAnthropicError } from "./anthropicErrors";

export interface UploadDocumentInput {
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  fileData: string; // base64-encoded file bytes
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPPORTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]);

interface ExtractedQuestion {
  prompt: string;
  passage?: string;
  choices: { text: string }[];
  correctChoiceIndex: number;
  explanation: string;
}

interface ExtractionResult {
  detectedTitle?: string;
  questions: ExtractedQuestion[];
}

const EXTRACT_QUESTIONS_TOOL = {
  name: "extract_questions",
  description:
    "Extract every multiple-choice question found in the document, along with the correct answer and a worked explanation for each.",
  input_schema: {
    type: "object" as const,
    properties: {
      detectedTitle: { type: "string", description: "A short descriptive title for this test paper" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The question text, transcribed verbatim from the document, exactly as printed",
            },
            passage: {
              type: "string",
              description: "Any shared reading passage or context the question refers to, if present, transcribed verbatim",
            },
            choices: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description:
                      "The exact text of this answer choice as printed in the document. Copy it verbatim, character " +
                      "for character — do not paraphrase, correct, simplify, or substitute a different value or wording, " +
                      "even if it looks unusual or you think a different value would make more sense.",
                  },
                },
                required: ["text"],
              },
              minItems: 2,
            },
            correctChoiceIndex: {
              type: "integer",
              description: "0-based index of the correct choice within the choices array",
            },
            explanation: {
              type: "string",
              description:
                "A clear, final explanation of why the correct answer is correct. Present only your finished " +
                "reasoning — do not show scratch work, do not second-guess or revise your answer mid-explanation, " +
                "and do not include phrases like 'wait', 'let me re-examine', or 'actually' that reveal you changed " +
                "your mind. Work it out silently first, then write only the clean final explanation.",
            },
          },
          required: ["prompt", "choices", "correctChoiceIndex", "explanation"],
        },
      },
    },
    required: ["questions"],
  },
};

function isValidExtractionResult(input: unknown): input is ExtractionResult {
  const candidate = input as Partial<ExtractionResult> | null | undefined;
  if (!candidate || !Array.isArray(candidate.questions)) return false;
  // Only the model-authored `explanation` field is checked for reasoning leaks — prompt/passage/
  // choices are meant to be verbatim transcriptions of the source document, so legitimate source
  // text (e.g. dialogue containing the word "wait") must never be rejected as a false positive.
  return candidate.questions.every((q) => !containsReasoningLeak(q?.explanation));
}

async function extractQuestionsFromDocument(base64Data: string, mediaType: string): Promise<ExtractionResult> {
  const documentBlock =
    mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64Data },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64Data,
          },
        };

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        tools: [EXTRACT_QUESTIONS_TOOL],
        tool_choice: { type: "tool", name: "extract_questions" },
        messages: [
          {
            role: "user",
            content: [
              documentBlock,
              {
                type: "text",
                text:
                  "This is a test or practice paper. Find every multiple-choice question in it and extract it via the " +
                  "extract_questions tool. Transcribe the question prompt, any shared passage, and every answer choice " +
                  "verbatim, exactly as printed in the document — do not paraphrase or alter any wording or values, even " +
                  "if a choice looks like a typo or seems mathematically inconsistent. Work out the correct answer " +
                  "yourself through careful reasoning (even if no answer key is shown), but keep that reasoning private " +
                  "and only report the final, clean explanation — never include hedging, self-correction, or 'wait, let " +
                  "me reconsider' language in the output.",
              },
            ],
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
      lastError = new Error("Could not extract any questions from that document.");
      continue;
    }
    if (!isValidExtractionResult(toolUse.input)) {
      lastError = new Error("The AI returned an unexpected response shape while extracting questions.");
      continue;
    }
    return toolUse.input;
  }
  throw lastError instanceof Error ? lastError : new Error("Could not extract any questions from that document.");
}

export async function uploadDocument(input: UploadDocumentInput): Promise<SmartStudioTest> {
  if (!SUPPORTED_TYPES.has(input.fileType)) {
    throw new Error(
      "Smart Studio currently supports PDF and image files (JPG, PNG, GIF, WEBP) — please upload one of those formats.",
    );
  }

  const extraction = await extractQuestionsFromDocument(input.fileData, input.fileType);
  if (extraction.questions.length === 0) {
    throw new Error("No questions could be recognized in that document. Try a clearer scan or a different file.");
  }

  const testId = `sst-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const questions: SmartStudioQuestion[] = extraction.questions.map((q, i) => {
    const questionId = `${testId}-q${i + 1}`;
    const choices: AnswerChoice[] = q.choices.map((c, j) => ({ id: `${questionId}-c${j}`, text: c.text }));
    const correctChoiceId = choices[q.correctChoiceIndex]?.id ?? choices[0].id;
    return {
      id: questionId,
      prompt: q.prompt,
      passage: q.passage,
      choices,
      correctChoiceId,
      explanation: q.explanation,
    };
  });

  const test: SmartStudioTest = {
    id: testId,
    fileName: input.fileName,
    fileType: input.fileType,
    fileSizeBytes: input.fileSizeBytes,
    uploadedAt: new Date().toISOString(),
    status: "ready",
    detectedTitle: extraction.detectedTitle?.trim() || input.fileName.replace(/\.[^.]+$/, ""),
    questions,
  };

  SMART_STUDIO_TESTS.unshift(test);
  return test;
}

export async function getUserTests(): Promise<SmartStudioTest[]> {
  await simulateLatency(250);
  return [...SMART_STUDIO_TESTS].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function getTest(id: string): Promise<SmartStudioTest | undefined> {
  await simulateLatency(200);
  return SMART_STUDIO_TESTS.find((t) => t.id === id);
}

// Grading is a straightforward equality check against the correct answer Claude determined at
// extraction time — the explanation surfaced here is the same real, paper-specific explanation
// generated then, not static mock text.
export async function gradeSubmission(
  testId: string,
  answers: Record<string, string | null>,
): Promise<SmartStudioGradedResult> {
  await simulateLatency(900);
  const test = SMART_STUDIO_TESTS.find((t) => t.id === testId);
  if (!test) throw new Error("Test not found");

  const results = test.questions.map((q) => {
    const selectedChoiceId = answers[q.id] ?? null;
    return {
      questionId: q.id,
      selectedChoiceId,
      isCorrect: selectedChoiceId === q.correctChoiceId,
      correctChoiceId: q.correctChoiceId,
      explanation: q.explanation,
    };
  });

  const graded: SmartStudioGradedResult = {
    testId,
    submittedAt: new Date().toISOString(),
    score: results.filter((r) => r.isCorrect).length,
    total: results.length,
    results,
  };

  test.lastResult = graded;
  return graded;
}

export interface AnswerKeyEntry {
  number: number;
  questionId: string;
  prompt: string;
  correctChoiceId: string;
  correctText: string;
  explanation: string;
}

export async function getAnswerKey(testId: string): Promise<AnswerKeyEntry[]> {
  await simulateLatency(300);
  const test = SMART_STUDIO_TESTS.find((t) => t.id === testId);
  if (!test) throw new Error("Test not found");

  return test.questions.map((q, i) => ({
    number: i + 1,
    questionId: q.id,
    prompt: q.prompt,
    correctChoiceId: q.correctChoiceId,
    correctText: q.choices.find((c) => c.id === q.correctChoiceId)?.text ?? "",
    explanation: q.explanation,
  }));
}
