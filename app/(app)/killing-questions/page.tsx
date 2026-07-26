"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Lock, Sparkles, Target, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Spinner } from "@/components/ui/Spinner";
import { useExamTheme } from "@/hooks/useExamTheme";
import type { KillingQuestionsResult } from "@/lib/services/killingQuestionsService";
import type { ExamType } from "@/lib/types";
import { accentForExam, type Accent } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";

const EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

const TAB_ACCENT_CLASSES: Record<Accent, string> = {
  dsat: "bg-dsat-soft text-dsat",
  ap: "bg-ap-soft text-ap",
  ielts: "bg-ielts-soft text-ielts",
  studio: "bg-studio-soft text-studio",
  neutral: "bg-surface-muted text-foreground",
};

function TargetedQuiz({ result, accent }: { result: KillingQuestionsResult; accent: ReturnType<typeof accentForExam> }) {
  const { targeted } = result;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (targeted.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Sparkles size={28} className="text-foreground-muted" aria-hidden="true" />
        <p className="text-foreground-muted">No targeted questions right now — great job, no glaring weak spots!</p>
      </Card>
    );
  }

  if (finished) {
    return (
      <Card className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Killing Questions complete</h2>
        <p className="mt-2 text-foreground-muted">
          You scored <span className="font-semibold text-foreground">{correctCount}</span> out of {targeted.length}.
        </p>
        <Button
          className="mt-4"
          accent={accent}
          onClick={() => {
            setIndex(0);
            setSelected(null);
            setCorrectCount(0);
            setFinished(false);
          }}
        >
          Practice again
        </Button>
      </Card>
    );
  }

  const item = targeted[index]!;
  const { question, reason } = item;
  const isAnswered = selected !== null;
  const isCorrect = selected === question.correctChoiceId;

  function handleSelect(choiceId: string) {
    if (isAnswered) return;
    setSelected(choiceId);
    if (choiceId === question.correctChoiceId) {
      setCorrectCount((c) => c + 1);
    }
  }

  function handleNext() {
    if (index + 1 >= targeted.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Targeted Practice</h2>
        <span className="text-sm text-foreground-muted">
          Question {index + 1} of {targeted.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge accent={accent}>{question.skillName}</Badge>
              <Badge accent="neutral" className="gap-1.5">
                <Target size={12} aria-hidden="true" />
                {reason}
              </Badge>
            </div>
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
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 rounded-lg bg-surface-muted p-3 text-sm text-foreground-muted"
              >
                {question.explanation}
              </motion.p>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      <Button accent={accent} onClick={handleNext} disabled={!isAnswered} className="self-end">
        {index + 1 >= targeted.length ? "Finish" : "Next question"}
      </Button>
    </div>
  );
}

export default function KillingQuestionsPage() {
  const [examType, setExamType] = useState<ExamType>("DSAT");
  const [result, setResult] = useState<KillingQuestionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError(null);
    fetch(`/api/killing-questions?examType=${examType}`)
      .then((res) => res.json())
      .then((data: KillingQuestionsResult | { error: string }) => {
        if (!active) return;
        if ("error" in data) {
          setError(data.error);
        } else {
          setResult(data);
        }
      })
      .catch(() => {
        if (active) setError("Something went wrong loading targeted questions. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [examType]);

  const accent = accentForExam(examType);
  useExamTheme(accent);

  return (
    <PageTransition className="rounded-2xl bg-[var(--accent-current-wash)] transition-colors duration-300 sm:p-2">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Killing Questions</h1>
          <p className="mt-1 text-foreground-muted">
            Once your readiness score clears the threshold, this mode surfaces fresh questions targeting your weakest skills.
          </p>
        </div>

        <nav className="flex gap-1 self-start rounded-lg border border-border bg-surface p-1">
          {EXAM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setExamType(type)}
              aria-current={examType === type ? "true" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                examType === type
                  ? TAB_ACCENT_CLASSES[accentForExam(type)]
                  : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {type}
            </button>
          ))}
        </nav>

        {error ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <XCircle size={28} className="text-red-500" aria-hidden="true" />
            <p className="text-foreground-muted">{error}</p>
          </Card>
        ) : !result ? (
          <Spinner label={`Loading ${examType} readiness…`} />
        ) : !result.unlocked ? (
          <Card className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
              <Lock size={24} className="text-foreground-muted" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Keep practicing to unlock</h2>
              <p className="mt-1 max-w-sm text-sm text-foreground-muted">
                Reach a readiness score of {result.threshold}% on {examType} to unlock questions targeting your weakest
                skills.
              </p>
            </div>
            <ProgressRing
              value={(result.readinessScore / result.threshold) * 100}
              accent={accent}
              label={`${result.readinessScore}%`}
              sublabel={`of ${result.threshold}% needed`}
              ariaLabel={`${examType} readiness: ${result.readinessScore} out of ${result.threshold} percent needed to unlock`}
            />
          </Card>
        ) : (
          <>
            <Card className="flex items-center gap-4 border-[var(--accent-current)]">
              <ProgressRing
                value={result.readinessScore}
                size={72}
                strokeWidth={8}
                accent={accent}
                ariaLabel={`${examType} readiness score: ${result.readinessScore} percent`}
              />
              <div>
                <CardHeader className="mb-1">
                  <CardTitle>Unlocked</CardTitle>
                  <Badge accent={accent}>{examType}</Badge>
                </CardHeader>
                <p className="text-sm text-foreground-muted">
                  Readiness score {result.readinessScore}% clears the {result.threshold}% threshold.
                </p>
              </div>
            </Card>
            <TargetedQuiz result={result} accent={accent} />
          </>
        )}
      </div>
    </PageTransition>
  );
}
