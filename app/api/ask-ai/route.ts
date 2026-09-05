import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { askQuestion, type AskAiHistoryMessage } from "@/lib/services/askAiService";

export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const body = (await request.json()) as { question?: string; history?: AskAiHistoryMessage[] };
  if (!body.question || !body.question.trim()) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }
  try {
    const answer = await askQuestion(body.question, body.history ?? []);
    return NextResponse.json(answer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ask AI is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
