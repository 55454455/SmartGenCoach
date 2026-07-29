import { NextResponse } from "next/server";
import { getQuestionsByDomain } from "@/lib/services/examService";
import type { ExamType, SkillDomain } from "@/lib/types";

const VALID_EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];
const VALID_DOMAINS: SkillDomain[] = [
  "Math",
  "Reading and Writing",
  "Calculus",
  "History",
  "Listening",
  "Reading",
  "Writing",
  "Speaking",
];

function isExamType(value: string): value is ExamType {
  return (VALID_EXAM_TYPES as string[]).includes(value);
}

function isSkillDomain(value: string): value is SkillDomain {
  return (VALID_DOMAINS as string[]).includes(value);
}

// Skill-practice sets are real Claude calls (thinking + up to 3 retries) — give them room to
// finish instead of getting killed by the platform's default serverless timeout.
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType");
  const domains = searchParams.getAll("domain");
  const countParam = searchParams.get("count");
  // Only Let's Play passes this today, to size a trivia room's question set independent of the
  // default Skill Practice count; clamp defensively since it drives how many parallel Claude calls fire.
  const count = countParam ? Math.min(Math.max(parseInt(countParam, 10) || 6, 1), 20) : undefined;

  if (!examType || !isExamType(examType)) {
    return NextResponse.json({ error: "Invalid or missing examType." }, { status: 400 });
  }
  if (domains.length === 0 || !domains.every(isSkillDomain)) {
    return NextResponse.json({ error: "Invalid or missing domain." }, { status: 400 });
  }

  try {
    const questionSets = await Promise.all(
      domains.map((domain) => (count ? getQuestionsByDomain(examType, domain, count) : getQuestionsByDomain(examType, domain))),
    );
    return NextResponse.json({ questions: questionSets.flat() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate practice questions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
