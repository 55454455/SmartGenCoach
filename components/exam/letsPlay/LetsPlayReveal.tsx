"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Lightbulb, XCircle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { LetsPlayAnswer, LetsPlayPlayer, Question } from "@/lib/types";

interface LetsPlayRevealProps {
  currentQuestion: Question;
  players: Record<string, LetsPlayPlayer>;
  currentAnswers: LetsPlayAnswer[];
  selfUserId: string;
  isHost: boolean;
  isLastQuestion: boolean;
  onNext: () => void | Promise<void>;
}

export function LetsPlayReveal({
  currentQuestion,
  players,
  currentAnswers,
  selfUserId,
  isHost,
  isLastQuestion,
  onNext,
}: LetsPlayRevealProps) {
  // The winner is whoever the DB's atomic scoring lock actually credited (points > 0), never a
  // client-side guess at who was "first" — see lets_play_submit_answer in the schema migration.
  const winnerAnswer = currentAnswers.find((a) => a.points > 0);
  const rankedAnswers = [...currentAnswers].sort((a, b) => b.points - a.points);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4"
    >
      <Card>
        <p className="mb-3 text-sm font-medium text-foreground-muted">{currentQuestion.prompt}</p>
        <div className="flex flex-col gap-2">
          {currentQuestion.choices.map((choice) => {
            const isCorrect = choice.id === currentQuestion.correctChoiceId;
            const pickedBy = currentAnswers.filter((a) => a.choiceId === choice.id);
            return (
              <div
                key={choice.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${
                  isCorrect ? "border-green-500 bg-green-500/10" : "border-border"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isCorrect ? (
                    <CheckCircle2 size={16} className="text-green-500" aria-hidden="true" />
                  ) : (
                    <XCircle size={16} className="text-foreground-muted/40" aria-hidden="true" />
                  )}
                  {choice.text}
                </span>
                {pickedBy.length > 0 && <span className="text-xs text-foreground-muted">{pickedBy.length} picked this</span>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="border-party/40 bg-party-soft/40">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-party-soft text-party">
            <Lightbulb size={18} aria-hidden="true" />
          </span>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Tips &amp; Tricks</h3>
              <Badge accent="party">{currentQuestion.category ?? currentQuestion.domain}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground-muted">
              {currentQuestion.tip ?? currentQuestion.explanation}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Round results</CardTitle>
          {winnerAnswer && (
            <Badge accent="party" className="gap-1">
              <Zap size={12} aria-hidden="true" />
              {players[winnerAnswer.userId]?.name ?? "Someone"} was fastest!
            </Badge>
          )}
        </CardHeader>
        <ul className="flex flex-col gap-2">
          {rankedAnswers.length === 0 && <li className="text-sm text-foreground-muted">Nobody answered in time.</li>}
          {rankedAnswers.map((answer) => {
            const player = players[answer.userId];
            const isSelf = answer.userId === selfUserId;
            return (
              <li
                key={answer.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-foreground-muted">
                    {player?.avatarInitials ?? "?"}
                  </span>
                  {player?.name ?? "Player"}
                  {isSelf && <span className="text-xs text-foreground-muted">(you)</span>}
                </span>
                <span className="flex items-center gap-2">
                  {answer.isCorrect ? (
                    <CheckCircle2 size={14} className="text-green-500" aria-hidden="true" />
                  ) : (
                    <XCircle size={14} className="text-red-500" aria-hidden="true" />
                  )}
                  <span className="font-semibold text-foreground">+{answer.points}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {isHost && (
        <Button accent="party" onClick={() => void onNext()} className="self-end">
          {isLastQuestion ? "See Final Results" : "Next Question"}
        </Button>
      )}
      {!isHost && <p className="text-center text-sm text-foreground-muted">Waiting for the host to continue…</p>}
    </motion.div>
  );
}
