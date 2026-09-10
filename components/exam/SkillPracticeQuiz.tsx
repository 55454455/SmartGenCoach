"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Accent } from "@/lib/utils/accent";
import type { Question } from "@/lib/types";

interface SkillPracticeQuizProps {
  title: string;
  questions: Question[];
  accent: Accent;
}

interface AnsweredQuestion {
  question: Question;
  correct: boolean;
}

export function SkillPracticeQuiz({ title, questions, accent }: SkillPracticeQuizProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState<AnsweredQuestion[]>([]);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) {
    return <p className="text-sm text-foreground-muted">No practice questions available for this skill yet.</p>;
  }

  const correctCount = answered.filter((a) => a.correct).length;

  if (finished) {
    // One representative tip per skill the student actually missed — not every question, since a
    // small set often repeats the same skill and repeating its tip verbatim adds nothing.
    const missedSkills: Question[] = [];
    const seenSkillIds = new Set<string>();
    for (const a of answered) {
      if (!a.correct && !seenSkillIds.has(a.question.skillId)) {
        seenSkillIds.add(a.question.skillId);
        missedSkills.push(a.question);
      }
    }
    const scorePct = Math.round((correctCount / questions.length) * 100);

    return (
      <Card className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Practice complete</h2>
        <p className="mt-2 text-foreground-muted">
          You scored <span className="font-semibold text-foreground">{correctCount}</span> out of {questions.length} (
          {scorePct}%).
        </p>

        {missedSkills.length > 0 ? (
          <div className="mt-5 flex flex-col gap-2 text-left">
            <h3 className="text-sm font-semibold text-foreground">Focus on these next</h3>
            {missedSkills.map((q) => (
              <div key={q.skillId} className="flex gap-2 rounded-lg bg-surface-muted p-3">
                <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">{q.skillName}</p>
                  {q.tip && <p className="mt-0.5 text-sm text-foreground-muted">{q.tip}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-foreground-muted">Perfect set — no weak spots to flag this time.</p>
        )}

        <Button
          className="mt-5"
          accent={accent}
          onClick={() => {
            setIndex(0);
            setSelected(null);
            setAnswered([]);
            setFinished(false);
          }}
        >
          Practice again
        </Button>
      </Card>
    );
  }

  const question = questions[index]!;
  const isAnswered = selected !== null;
  const isCorrect = selected === question.correctChoiceId;

  function handleSelect(choiceId: string) {
    if (isAnswered) return;
    setSelected(choiceId);
    setAnswered((a) => [...a, { question, correct: choiceId === question.correctChoiceId }]);
  }

  function handleNext() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-foreground-muted">
          Question {index + 1} of {questions.length}
        </span>
      </div>
      <ProgressBar
        value={(index / questions.length) * 100}
        accent={accent}
        ariaLabel={`Progress: question ${index + 1} of ${questions.length}`}
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
            <Badge accent={accent} className="mb-3">
              {question.skillName}
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
                    className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                      showCorrect
                        ? "border-green-500 bg-green-500/10"
                        : showIncorrect
                          ? "border-red-500 bg-red-500/10"
                          : "border-border hover:bg-surface-muted"
                    } disabled:cursor-default`}
                  >
                    <span>{choice.text}</span>
                    {showCorrect && <CheckCircle2 size={16} className="text-green-500" aria-hidden="true" />}
                    {showIncorrect && <XCircle size={16} className="text-red-500" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {isAnswered && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-col gap-2">
                <p className="rounded-lg bg-surface-muted p-3 text-sm text-foreground-muted">{question.explanation}</p>
                {question.tip && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-foreground">
                    <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                    <span>{question.tip}</span>
                  </p>
                )}
              </motion.div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      <Button accent={accent} onClick={handleNext} disabled={!isAnswered} className="self-end">
        {index + 1 >= questions.length ? "Finish" : "Next question"}
      </Button>
    </div>
  );
}
