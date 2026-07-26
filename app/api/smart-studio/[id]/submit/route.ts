import { NextResponse } from "next/server";
import { gradeSubmission } from "@/lib/services/smartStudioService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { answers: Record<string, string | null> };
  const graded = await gradeSubmission(id, body.answers);
  return NextResponse.json(graded);
}
