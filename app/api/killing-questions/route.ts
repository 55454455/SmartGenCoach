import { NextResponse } from "next/server";
import { getKillingQuestions } from "@/lib/services/killingQuestionsService";
import type { ExamType } from "@/lib/types";

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
