import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getUploadedExam } from "@/lib/services/uploadedExamService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { id } = await params;
  const exam = await getUploadedExam(id);
  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  return NextResponse.json(exam);
}
