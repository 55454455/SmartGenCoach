import Anthropic from "@anthropic-ai/sdk";
import { ASK_AI_AGENT_NAME } from "./askAiConstants";

export { ASK_AI_AGENT_NAME };

export interface AskAiAnswer {
  id: string;
  agentName: string;
  content: string;
  createdAt: string;
}

export interface AskAiHistoryMessage {
  role: "user" | "agent";
  content: string;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT =
  "You are Nova, an encouraging, precise test-prep tutor inside SmartGenCoach, a DSAT/AP/IELTS prep " +
  "platform. Students ask you quick questions while studying. Explain the underlying concept, show how " +
  "to apply it, and walk through a short worked example when useful. Keep responses focused — under " +
  "roughly 150 words unless the question genuinely needs more. Don't invent facts about the student's " +
  "personal history or scores unless they're stated in the conversation.";

export async function askQuestion(question: string, history: AskAiHistoryMessage[] = []): Promise<AskAiAnswer> {
  const trimmed = question.trim();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      ...history.map((m) => ({
        role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: trimmed },
    ],
  });

  const content =
    response.content.find((block) => block.type === "text")?.text ??
    "Sorry, I couldn't come up with an answer to that — try rephrasing the question?";

  return {
    id: `ask-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    agentName: ASK_AI_AGENT_NAME,
    content,
    createdAt: new Date().toISOString(),
  };
}
