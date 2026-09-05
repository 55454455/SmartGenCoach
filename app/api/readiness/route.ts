import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getAllReadinessReports, getReadinessReport } from "@/lib/services/readinessService";
import type { ExamType } from "@/lib/types";

const VALID_EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

function isExamType(value: string): value is ExamType {
  return (VALID_EXAM_TYPES as string[]).includes(value);
}

// PHASE2: readiness is computed live by the Orchestrator Agent from full attempt history.
export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType");
  const userId = auth.session.user.id;

  if (!examType) {
    const all = await getAllReadinessReports(userId);
    return NextResponse.json(all);
  }

  if (!isExamType(examType)) {
    return NextResponse.json({ error: "Invalid examType." }, { status: 400 });
  }

  const report = await getReadinessReport(userId, examType);
  return NextResponse.json(report);
}
