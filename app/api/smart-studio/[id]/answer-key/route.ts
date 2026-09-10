import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getAnswerKey } from "@/lib/services/smartStudioService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const answerKey = await getAnswerKey(id, auth.session.user.id);
    return NextResponse.json(answerKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load that answer key.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
