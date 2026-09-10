import { NextResponse } from "next/server";
import { requireRateLimit, requireSession } from "@/lib/services/apiAuth";
import { askQuestion, type AskAiHistoryMessage } from "@/lib/services/askAiService";

export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const limited = requireRateLimit(auth.session.user.id, "ask-ai", 20, 10 * 60 * 1000);
  if (limited) return limited;

  let body: { question?: string; history?: AskAiHistoryMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
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
