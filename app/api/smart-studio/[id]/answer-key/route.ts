import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getAnswerKey } from "@/lib/services/smartStudioService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { id } = await params;
  const answerKey = await getAnswerKey(id);
  return NextResponse.json(answerKey);
}
