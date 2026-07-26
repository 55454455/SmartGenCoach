"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, X } from "lucide-react";
import { useState } from "react";
import { ASK_AI_AGENT_NAME } from "@/lib/services/askAiConstants";
import { cn } from "@/lib/utils/cn";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "agent",
  content: `Hi, I'm ${ASK_AI_AGENT_NAME}. Ask me any question, or ask me to explain something on the go.`,
};

export function AskAiWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const question = input.trim();
    if (!question || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: question }]);
    setSending(true);
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: messages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { id: string; content: string } | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Ask AI is temporarily unavailable.");
      }
      setMessages((prev) => [...prev, { id: data.id, role: "agent", content: data.content }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sorry, something went wrong. Try asking again?";
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "agent", content: message }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Ask AI" : `Open Ask AI, chat with ${ASK_AI_AGENT_NAME}`}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X size={22} aria-hidden="true" /> : <Bot size={22} aria-hidden="true" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-24 right-5 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            role="dialog"
            aria-label={`${ASK_AI_AGENT_NAME} chat`}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-foreground">
                <Bot size={16} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{ASK_AI_AGENT_NAME}</p>
                <p className="text-xs text-foreground-muted">Ask anything, on the go</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "agent"
                      ? "self-start bg-surface-muted text-foreground"
                      : "self-end bg-foreground text-background",
                  )}
                >
                  {m.content}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 self-start rounded-xl bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  {ASK_AI_AGENT_NAME} is thinking…
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border p-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSend();
                }}
                placeholder="Ask a question…"
                aria-label="Ask a question"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-foreground-muted"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
