import { NextResponse } from "next/server";
import { getKillingQuestions } from "@/lib/services/killingQuestionsService";
import type { ExamType } from "@/lib/types";

// Question generation is a real Claude call (with thinking + up to 3 retries) — give it room to
// finish instead of getting killed by the platform's default serverless timeout.
export const maxDuration = 60;

const VALID_EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

function isExamType(value: string): value is ExamType {
  return (VALID_EXAM_TYPES as string[]).includes(value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType") ?? "DSAT";

  if (!isExamType(examType)) {
    return NextResponse.json({ error: "Invalid examType." }, { status: 400 });
  }

  try {
    const result = await getKillingQuestions(examType);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate targeted practice questions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
