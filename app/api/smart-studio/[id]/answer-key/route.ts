import { NextResponse } from "next/server";
import { getAnswerKey } from "@/lib/services/smartStudioService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const answerKey = await getAnswerKey(id);
  return NextResponse.json(answerKey);
}
