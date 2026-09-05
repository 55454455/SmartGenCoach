import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { gradeSubmission } from "@/lib/services/smartStudioService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as { answers: Record<string, string | null> };
  const graded = await gradeSubmission(id, body.answers);
  return NextResponse.json(graded);
}
