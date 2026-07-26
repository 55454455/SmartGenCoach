"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, PartyPopper, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import type { SmartStudioGradedResult, SmartStudioTest } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface SmartStudioQuizProps {
  test: SmartStudioTest;
}

export function SmartStudioQuiz({ test }: SmartStudioQuizProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [graded, setGraded] = useState<SmartStudioGradedResult | null>(null);

  const question = test.questions[index]!;
  const isAnswered = selected !== null;
  const isCorrect = selected === question.correctChoiceId;
  const isLastQuestion = index + 1 >= test.questions.length;

  function handleSelect(choiceId: string) {
    if (isAnswered) return;
    setSelected(choiceId);
  }

  async function handleNext() {
    const nextAnswers = { ...answers, [question.id]: selected! };
    setAnswers(nextAnswers);

    if (!isLastQuestion) {
      setIndex((i) => i + 1);
      setSelected(null);
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/smart-studio/${test.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: nextAnswers }),
    });
    const result = (await res.json()) as SmartStudioGradedResult;
    setGraded(result);
    setSubmitting(false);
  }

  if (submitting) {
    return <Spinner label="AI agent is grading your answers…" />;
  }

  if (graded) {
    const pct = Math.round((graded.score / graded.total) * 100);
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <PartyPopper size={28} className="text-studio" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">Grading complete</h2>
        <p className="text-foreground-muted">
          You scored <span className="font-semibold text-foreground">{graded.score}</span> out of {graded.total} (
          {pct}%).
        </p>
        <div className="mt-2 flex gap-2">
          <Link href={`/smart-studio/${test.id}/answer-key`}>
            <Button accent="studio" variant="secondary">
              View full answer key
            </Button>
          </Link>
          <Link href="/smart-studio">
            <Button accent="studio">Back to Smart Studio</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{test.detectedTitle}</h2>
        <span className="text-sm text-foreground-muted">
          Question {index + 1} of {test.questions.length}
        </span>
      </div>
      <ProgressBar
        value={(index / test.questions.length) * 100}
        accent="studio"
        ariaLabel={`Progress: question ${index + 1} of ${test.questions.length}`}
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
            <Badge accent="studio" className="mb-3">
              Recognized question
            </Badge>
            {question.passage && (
              <p className="mb-3 rounded-lg bg-surface-muted p-3 text-sm leading-relaxed text-foreground-muted">
                {question.passage}
              </p>
            )}
            <p className="mb-4 font-medium text-foreground">{question.prompt}</p>
            <div className="flex flex-col gap-2">
              {question.choices.map((choice) => {
                const showCorrect = isAnswered && choice.id === question.correctChoiceId;
                const showIncorrect = isAnswered && choice.id === selected && !isCorrect;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleSelect(choice.id)}
                    disabled={isAnswered}
                    aria-pressed={selected === choice.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-default",
                      showCorrect
                        ? "border-green-500 bg-green-500/10"
                        : showIncorrect
                          ? "border-red-500 bg-red-500/10"
                          : "border-border hover:bg-surface-muted",
                    )}
                  >
                    <span>{choice.text}</span>
                    {showCorrect && <CheckCircle2 size={16} className="text-green-500" aria-hidden="true" />}
                    {showIncorrect && <XCircle size={16} className="text-red-500" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 rounded-lg bg-surface-muted p-3 text-sm text-foreground-muted"
              >
                <p className="mb-1 font-medium text-foreground">
                  {isCorrect ? "Correct — here's why:" : "Not quite — here's why:"}
                </p>
                {question.explanation}
              </motion.div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      <Button accent="studio" onClick={handleNext} disabled={!isAnswered} className="self-end">
        {isLastQuestion ? "Finish & grade" : "Next question"}
      </Button>
    </div>
  );
}
