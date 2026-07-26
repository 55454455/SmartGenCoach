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

// PHASE2: skill-practice sets are generated fresh per student by the relevant subject agent.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType");
  const domains = searchParams.getAll("domain");

  if (!examType || !isExamType(examType)) {
    return NextResponse.json({ error: "Invalid or missing examType." }, { status: 400 });
  }
  if (domains.length === 0 || !domains.every(isSkillDomain)) {
    return NextResponse.json({ error: "Invalid or missing domain." }, { status: 400 });
  }

  const questionSets = await Promise.all(domains.map((domain) => getQuestionsByDomain(examType, domain)));
  return NextResponse.json({ questions: questionSets.flat() });
}
