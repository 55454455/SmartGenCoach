import dns from "node:dns/promises";
import Anthropic from "@anthropic-ai/sdk";
import { UPLOADED_EXAMS } from "@/lib/mockData";
import type { AnswerChoice, ExamModule, ExamType, Question, SkillDomain, UploadedExam } from "@/lib/types";
import { containsReasoningLeak } from "./aiTextSafety";
import { describeAnthropicError } from "./anthropicErrors";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPPORTED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_FETCH_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_TEXT_CHARS = 50_000;

function domainsForExamType(examType: ExamType): SkillDomain[] {
  switch (examType) {
    case "DSAT":
      return ["Math", "Reading and Writing"];
    case "AP":
      return ["Calculus", "History"];
    case "IELTS":
      return ["Listening", "Reading", "Writing", "Speaking"];
  }
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "general";
}

// --- SSRF-safe URL fetching --------------------------------------------------------------

function ipv4ToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const long = ipv4ToLong(ip);
  const ranges: [string, number][] = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return ranges.some(([base, prefix]) => {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (long & mask) === (ipv4ToLong(base) & mask);
  });
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("::ffff:")) {
    const embedded = lower.slice("::ffff:".length);
    if (embedded.includes(".")) return isPrivateIpv4(embedded);
  }
  return false;
}

// Every redirect hop must re-resolve and re-check the hostname — otherwise a public URL that
// 302s to http://169.254.169.254 (cloud metadata) or an internal host would slip through.
async function assertUrlIsSafe(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }
  const { address, family } = await dns.lookup(url.hostname);
  const isPrivate = family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
  if (isPrivate) {
    throw new Error("That URL points to a private or internal address, which isn't allowed.");
  }
  return url;
}

async function fetchUrlSafely(rawUrl: string): Promise<{ contentType: string; buffer: Buffer }> {
  let currentUrl = await assertUrlIsSafe(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const res = await fetch(currentUrl, { signal: controller.signal, redirect: "manual" });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("That URL redirected without a destination.");
        currentUrl = await assertUrlIsSafe(new URL(location, currentUrl).toString());
        continue;
      }

      if (!res.ok) {
        throw new Error(`That URL responded with an error (status ${res.status}).`);
      }

      const contentLength = Number(res.headers.get("content-length") ?? "0");
      if (contentLength > MAX_FETCH_BYTES) {
        throw new Error("That file is too large to import (15MB limit).");
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_FETCH_BYTES) {
        throw new Error("That file is too large to import (15MB limit).");
      }

      return { contentType: res.headers.get("content-type") ?? "text/html", buffer: Buffer.from(arrayBuffer) };
    }
    throw new Error("That URL redirected too many times.");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("That URL took too long to respond.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTextFromHtml(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, MAX_HTML_TEXT_CHARS);
}

// --- Claude extraction --------------------------------------------------------------------

interface ExtractedQuestion {
  prompt: string;
  passage?: string;
  choices: { text: string }[];
  correctChoiceIndex: number;
  explanation: string;
  domain: SkillDomain;
  skillName: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

interface ExtractionResult {
  detectedTitle?: string;
  questions: ExtractedQuestion[];
}

function buildExtractTool(examType: ExamType) {
  const domains = domainsForExamType(examType);
  return {
    name: "extract_exam_questions",
    description: `Extract multiple-choice questions suitable for a ${examType} practice exam from the given source, each solved and categorized.`,
    input_schema: {
      type: "object" as const,
      properties: {
        detectedTitle: { type: "string", description: "A short descriptive title for this exam/source" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "The question text. If it already exists in the source, transcribe it verbatim; only write it " +
                  "yourself if the source has no pre-existing question text to copy.",
              },
              passage: {
                type: "string",
                description:
                  "Any shared reading passage or context the question refers to, if present. Transcribe verbatim " +
                  "if it exists in the source.",
              },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description:
                        "The exact answer choice text. If the source already shows multiple-choice options, copy " +
                        "them verbatim, character for character — never paraphrase, correct, or substitute a " +
                        "different value or wording, even if a choice looks unusual. Only invent new choice text " +
                        "when the source has no pre-existing options to copy from.",
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
                  "and do not include phrases like 'wait', 'let me re-examine', or 'actually' that reveal you " +
                  "changed your mind. Work it out silently first, then write only the clean final explanation.",
              },
              domain: { type: "string", enum: domains, description: "Which exam domain this question belongs to" },
              skillName: {
                type: "string",
                description: "A short sub-skill label, e.g. 'Quadratic Functions' or 'Inference'",
              },
              difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
            },
            required: ["prompt", "choices", "correctChoiceIndex", "explanation", "domain", "skillName", "difficulty"],
          },
        },
      },
      required: ["questions"],
    },
  };
}

const EXTRACTION_INSTRUCTIONS =
  "Find every question suitable for turning into a multiple-choice practice question and extract it via the " +
  "extract_exam_questions tool. If a question refers to a shared reading passage, include that passage text. " +
  "Where the source already contains question text and/or answer choices, transcribe them verbatim — do not " +
  "paraphrase, correct, or alter any wording or values, even if something looks like a typo or seems inconsistent. " +
  "Only write original question text or choices yourself when the source has no pre-existing options to copy " +
  "(e.g. a general webpage with no built-in multiple-choice questions). Solve each question yourself and determine " +
  "the correct answer through your own reasoning, even if no answer key is present in the source — but keep that " +
  "reasoning private and report only the final, clean explanation, with no hedging or self-correction language. " +
  "Categorize each question into the correct domain, a short skill label, and a difficulty level.";

function isValidExtractionResult(input: unknown): input is ExtractionResult {
  const candidate = input as Partial<ExtractionResult> | null | undefined;
  if (!candidate || !Array.isArray(candidate.questions)) return false;
  // Only the model-authored `explanation` field is checked for reasoning leaks — prompt/passage/
  // choices are meant to be verbatim transcriptions of the source, so legitimate source text must
  // never be rejected as a false positive.
  return candidate.questions.every((q) => !containsReasoningLeak(q?.explanation));
}

async function extractFromDocument(examType: ExamType, base64Data: string, mediaType: string): Promise<ExtractionResult> {
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
        tools: [buildExtractTool(examType)],
        tool_choice: { type: "tool", name: "extract_exam_questions" },
        messages: [
          {
            role: "user",
            content: [documentBlock, { type: "text", text: `This is a ${examType} test paper. ${EXTRACTION_INSTRUCTIONS}` }],
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

async function extractFromText(examType: ExamType, text: string): Promise<ExtractionResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        tools: [buildExtractTool(examType)],
        tool_choice: { type: "tool", name: "extract_exam_questions" },
        messages: [
          {
            role: "user",
            content: `This is the text content of a webpage that may contain a ${examType} practice test. ${EXTRACTION_INSTRUCTIONS}\n\n---\n\n${text}`,
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
      lastError = new Error("Could not extract any questions from that page.");
      continue;
    }
    if (!isValidExtractionResult(toolUse.input)) {
      lastError = new Error("The AI returned an unexpected response shape while extracting questions.");
      continue;
    }
    return toolUse.input;
  }
  throw lastError instanceof Error ? lastError : new Error("Could not extract any questions from that page.");
}

function finalizeExam(
  examType: ExamType,
  sourceType: "document" | "url",
  sourceName: string,
  extraction: ExtractionResult,
): UploadedExam {
  if (extraction.questions.length === 0) {
    throw new Error("No questions could be recognized from that source. Try a clearer file or a different link.");
  }

  const examId = `upl-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const questions: Question[] = extraction.questions.map((q, i) => {
    const questionId = `${examId}-q${i + 1}`;
    const choices: AnswerChoice[] = q.choices.map((c, j) => ({ id: `${questionId}-c${j}`, text: c.text }));
    const correctChoiceId = choices[q.correctChoiceIndex]?.id ?? choices[0].id;
    return {
      id: questionId,
      examType,
      domain: q.domain,
      skillId: slugify(q.skillName),
      skillName: q.skillName,
      prompt: q.prompt,
      passage: q.passage,
      choices,
      correctChoiceId,
      difficulty: q.difficulty,
      explanation: q.explanation,
    };
  });

  const domainsInOrder = Array.from(new Set(questions.map((q) => q.domain)));
  const modules: ExamModule[] = domainsInOrder.map((domain, i) => {
    const domainQuestions = questions.filter((q) => q.domain === domain);
    return {
      id: `${examId}-module-${i}`,
      title: `Module ${i + 1}: ${domain}`,
      domain,
      durationSeconds: domainQuestions.length * 90,
      questionIds: domainQuestions.map((q) => q.id),
    };
  });

  const questionsById: Record<string, Question> = {};
  for (const q of questions) questionsById[q.id] = q;

  const exam: UploadedExam = {
    id: examId,
    examType,
    sourceType,
    sourceName,
    detectedTitle: extraction.detectedTitle?.trim() || sourceName,
    uploadedAt: new Date().toISOString(),
    modules,
    questionsById,
  };

  UPLOADED_EXAMS.unshift(exam);
  return exam;
}

export interface CreateFromDocumentInput {
  examType: ExamType;
  fileName: string;
  fileType: string;
  fileData: string; // base64
}

export async function createUploadedExamFromDocument(input: CreateFromDocumentInput): Promise<UploadedExam> {
  if (!SUPPORTED_DOCUMENT_TYPES.has(input.fileType)) {
    throw new Error(
      "Upload Exam currently supports PDF and image files (JPG, PNG, GIF, WEBP) — please upload one of those formats.",
    );
  }
  const extraction = await extractFromDocument(input.examType, input.fileData, input.fileType);
  return finalizeExam(input.examType, "document", input.fileName, extraction);
}

export interface CreateFromUrlInput {
  examType: ExamType;
  sourceUrl: string;
}

export async function createUploadedExamFromUrl(input: CreateFromUrlInput): Promise<UploadedExam> {
  const { contentType, buffer } = await fetchUrlSafely(input.sourceUrl);
  const baseType = contentType.split(";")[0].trim();

  let extraction: ExtractionResult;
  if (SUPPORTED_DOCUMENT_TYPES.has(baseType)) {
    extraction = await extractFromDocument(input.examType, buffer.toString("base64"), baseType);
  } else {
    const text = extractTextFromHtml(buffer.toString("utf-8"));
    if (!text) {
      throw new Error("That page doesn't seem to contain any readable text.");
    }
    extraction = await extractFromText(input.examType, text);
  }

  return finalizeExam(input.examType, "url", input.sourceUrl, extraction);
}

export async function getUploadedExams(examType?: ExamType): Promise<UploadedExam[]> {
  const exams = examType ? UPLOADED_EXAMS.filter((e) => e.examType === examType) : UPLOADED_EXAMS;
  return [...exams].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function getUploadedExam(id: string): Promise<UploadedExam | undefined> {
  return UPLOADED_EXAMS.find((e) => e.id === id);
}
