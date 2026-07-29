"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Timer, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { QUESTION_SECONDS } from "@/lib/constants/letsPlay";
import type { LetsPlayAnswer, LetsPlayPlayer, LetsPlayRoom, Question } from "@/lib/types";

interface MyAnswerState {
  choiceId: string;
  isCorrect: boolean;
  points: number;
  isFirst: boolean;
}

interface LetsPlayQuestionProps {
  room: LetsPlayRoom;
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  players: Record<string, LetsPlayPlayer>;
  currentAnswers: LetsPlayAnswer[];
  myAnswer: MyAnswerState | null;
  onAnswer: (choiceId: string) => void;
}

export function LetsPlayQuestion({
  room,
  question,
  questionNumber,
  totalQuestions,
  players,
  currentAnswers,
  myAnswer,
  onAnswer,
}: LetsPlayQuestionProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [room.currentQuestionId]);

  const startedAt = room.currentQuestionStartedAt ? new Date(room.currentQuestionStartedAt).getTime() : now;
  const remainingSeconds = Math.max(0, Math.ceil(QUESTION_SECONDS - (now - startedAt) / 1000));
  const isAnswered = myAnswer !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground-muted">
          Question {questionNumber} of {totalQuestions}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-party">
          <Timer size={16} aria-hidden="true" />
          {remainingSeconds}s
        </span>
      </div>
      <ProgressBar
        value={(remainingSeconds / QUESTION_SECONDS) * 100}
        accent="party"
        ariaLabel={`${remainingSeconds} seconds remaining`}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <Badge accent="party" className="mb-3">
              {question.category ?? `${room.examType} · ${room.domain}`}
            </Badge>
            {question.passage && (
              <p className="mb-3 rounded-lg bg-surface-muted p-3 text-sm leading-relaxed text-foreground-muted">
                {question.passage}
              </p>
            )}
            <p className="mb-4 font-medium text-foreground">{question.prompt}</p>
            <div className="flex flex-col gap-2">
              {question.choices.map((choice) => {
                const isSelected = myAnswer?.choiceId === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => onAnswer(choice.id)}
                    disabled={isAnswered}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                      isSelected ? "border-party bg-party-soft text-foreground" : "border-border hover:bg-surface-muted"
                    } disabled:cursor-default`}
                  >
                    <span>{choice.text}</span>
                    {isSelected && <Check size={16} className="text-party" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      <Card className="flex items-center justify-between">
        <span className="text-sm text-foreground-muted">
          {currentAnswers.length} of {Object.keys(players).length} answered
        </span>
        <div className="flex -space-x-2">
          {currentAnswers.map((answer) => {
            const player = players[answer.userId];
            const isWinner = answer.points > 0;
            return (
              <span
                key={answer.id}
                title={player?.name ?? "Player"}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-[10px] font-semibold ${
                  isWinner ? "bg-party text-white" : "bg-surface-muted text-foreground-muted"
                }`}
              >
                {isWinner ? <Zap size={12} aria-hidden="true" /> : player?.avatarInitials ?? "?"}
              </span>
            );
          })}
        </div>
      </Card>

      {isAnswered && (
        <p className="text-center text-sm text-foreground-muted">
          Answer locked in — waiting for the timer or the rest of the room…
        </p>
      )}
    </div>
  );
}
