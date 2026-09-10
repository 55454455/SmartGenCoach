import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { gradeSubmission } from "@/lib/services/smartStudioService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const body = (await request.json()) as { answers?: Record<string, string | null> };
    if (!body.answers || typeof body.answers !== "object") {
      return NextResponse.json({ error: "answers is required." }, { status: 400 });
    }
    const graded = await gradeSubmission(id, auth.session.user.id, body.answers);
    return NextResponse.json(graded);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not grade that submission.";
    return NextResponse.json({ error: message }, { status: message === "Test not found" ? 404 : 400 });
  }
}
