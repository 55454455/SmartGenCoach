import { NextResponse } from "next/server";
import { askQuestion, type AskAiHistoryMessage } from "@/lib/services/askAiService";

export async function POST(request: Request) {
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
