"use client";

import { Swords, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { useExamTheme } from "@/hooks/useExamTheme";
import { createRoom, generateTriviaQuestions, getRoomByCode } from "@/lib/services/letsPlayService";
import { useAuthStore } from "@/lib/store/authStore";
import type { ExamType, SkillDomain } from "@/lib/types";

// Restricted to domains that make sense as fast, multiple-choice trivia rounds — IELTS Listening
// needs synced audio and Writing/Speaking aren't multiple-choice, so they're left out here even
// though generateExamQuestions() could technically produce something for them.
const LETS_PLAY_DOMAINS: Record<ExamType, SkillDomain[]> = {
  DSAT: ["Math", "Reading and Writing"],
  AP: ["Calculus", "History"],
  IELTS: ["Reading"],
};

const QUESTION_COUNTS = [5, 8, 10];

export default function LetsPlaySetupPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [examType, setExamType] = useState<ExamType>("DSAT");
  const [domain, setDomain] = useState<SkillDomain>("Math");
  const [count, setCount] = useState(8);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useExamTheme("party");

  function handleExamTypeChange(next: ExamType) {
    setExamType(next);
    setDomain(LETS_PLAY_DOMAINS[next][0]!);
  }

  async function handleCreate() {
    if (!session) return;
    setCreating(true);
    setCreateError(null);
    try {
      const questions = await generateTriviaQuestions(examType, domain, count);
      const room = await createRoom({
        examType,
        domain,
        questions,
        hostId: session.user.id,
        hostName: session.user.name,
        hostAvatarInitials: session.user.avatarInitials,
      });
      router.push(`/lets-play/${room.code}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create the room. Please try again.");
      setCreating(false);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError("Enter the room code your host shared with you.");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const room = await getRoomByCode(code);
      if (!room) {
        setJoinError("No room found with that code.");
        setJoining(false);
        return;
      }
      router.push(`/lets-play/${room.code}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not find that room.");
      setJoining(false);
    }
  }

  return (
    <PageTransition className="rounded-2xl bg-[var(--accent-current-wash)] transition-colors duration-300 sm:p-2">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-party-soft text-party">
            <Swords size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Let&apos;s Play</h1>
            <p className="text-sm text-foreground-muted">Real-time trivia — race your friends to the correct answer.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Host a new room</CardTitle>
            <Badge accent="party">Live</Badge>
          </CardHeader>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-muted">Exam</label>
              <div className="flex gap-2">
                {(Object.keys(LETS_PLAY_DOMAINS) as ExamType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleExamTypeChange(type)}
                    aria-pressed={examType === type}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      examType === type ? "border-party bg-party-soft text-party" : "border-border text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-muted">Category</label>
              <div className="flex flex-wrap gap-2">
                {LETS_PLAY_DOMAINS[examType].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDomain(d)}
                    aria-pressed={domain === d}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      domain === d ? "border-party bg-party-soft text-party" : "border-border text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-muted">Questions</label>
              <div className="flex gap-2">
                {QUESTION_COUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCount(c)}
                    aria-pressed={count === c}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      count === c ? "border-party bg-party-soft text-party" : "border-border text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {createError && <p className="text-sm text-red-500">{createError}</p>}

            <Button accent="party" onClick={handleCreate} disabled={creating}>
              {creating ? "Generating questions…" : "Create Room"}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join a room</CardTitle>
            <Users size={18} className="text-foreground-muted" aria-hidden="true" />
          </CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={6}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm uppercase tracking-widest text-foreground placeholder:normal-case placeholder:tracking-normal placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-party"
            />
            <Button accent="party" variant="secondary" onClick={handleJoin} disabled={joining}>
              {joining ? "Joining…" : "Join Room"}
            </Button>
          </div>
          {joinError && <p className="mt-2 text-sm text-red-500">{joinError}</p>}
        </Card>
      </div>
    </PageTransition>
  );
}
