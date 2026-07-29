"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BluebookLayout } from "@/components/exam/BluebookLayout";
import { CalculatorModal } from "@/components/exam/CalculatorModal";
import { SplitScreen } from "@/components/exam/SplitScreen";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useCountdown } from "@/hooks/useCountdown";
import { useExamTheme } from "@/hooks/useExamTheme";
import type { DsatExamBundle } from "@/lib/services/examService";
import { useAuthStore } from "@/lib/store/authStore";
import { useDsatExamStore } from "@/lib/store/dsatExamStore";
import { cn } from "@/lib/utils/cn";

const DIRECTIONS: Record<string, string> = {
  "Reading and Writing":
    "The passages in this section are followed by a question. Read each passage and then choose the best answer to the accompanying question. All questions are multiple-choice with four possible answers.",
  Math: "You may use a calculator for this module. All variables and expressions represent real numbers unless otherwise indicated. For multiple-choice questions, solve each problem and choose the best answer from the four choices provided.",
};

export default function DsatExamPage() {
  const router = useRouter();
  const studentName = useAuthStore((s) => s.session?.user.name) ?? "Student";
  const [bundle, setBundle] = useState<DsatExamBundle | null>(null);
  const [examFinished, setExamFinished] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moduleTransitionLoading, setModuleTransitionLoading] = useState(false);
  const resetOnce = useRef(false);
  const advancingRef = useRef(false);

  useExamTheme("dsat");

  const {
    currentModuleIndex,
    currentQuestionIndex,
    answers,
    flagged,
    eliminated,
    timerHidden,
    calculatorOpen,
    eliminatorMode,
    navigatorOpen,
    directionsOpen,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    advanceModule,
    selectAnswer,
    toggleFlag,
    toggleEliminated,
    toggleTimerHidden,
    toggleCalculator,
    toggleEliminatorMode,
    toggleNavigator,
    toggleDirections,
    reset,
  } = useDsatExamStore();

  useEffect(() => {
    if (resetOnce.current) return;
    resetOnce.current = true;
    reset();
    fetch("/api/exam/dsat")
      .then(async (res) => {
        const data = (await res.json()) as DsatExamBundle | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Could not generate this exam.");
        }
        setBundle(data);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not generate this exam.");
      });
  }, [reset]);

  const currentModule = bundle?.modules[currentModuleIndex];
  const currentQuestionId = currentModule?.questionIds[currentQuestionIndex];
  const currentQuestion = currentQuestionId ? bundle?.questionsById[currentQuestionId] : undefined;

  const isLastModule = bundle ? currentModuleIndex === bundle.modules.length - 1 : false;
  const isLastQuestionInModule = currentModule ? currentQuestionIndex === currentModule.questionIds.length - 1 : false;

  const finishExam = () => {
    setExamFinished(true);
  };

  // Module 2 for each domain starts as an empty placeholder (see getDsatExamBundle) — its real,
  // difficulty-adjusted content is fetched here, right as the student finishes Module 1 for that
  // domain, using their own Module 1 score to pick Module 2's difficulty.
  const advanceToModule = async (nextIndex: number) => {
    if (advancingRef.current || !bundle) return;
    const nextModule = bundle.modules[nextIndex];
    if (nextModule && nextModule.questionIds.length === 0 && (nextModule.domain === "Math" || nextModule.domain === "Reading and Writing")) {
      advancingRef.current = true;
      setModuleTransitionLoading(true);
      const priorModule = bundle.modules[nextIndex - 1];
      const total = priorModule?.questionIds.length ?? 0;
      const correctCount = (priorModule?.questionIds ?? []).filter(
        (qid) => answers[qid] && answers[qid] === bundle.questionsById[qid]?.correctChoiceId,
      ).length;

      try {
        const res = await fetch("/api/exam/dsat/adaptive-module", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: nextModule.domain, correctCount, total }),
        });
        const data = (await res.json()) as
          | { module: DsatExamBundle["modules"][number]; questionsById: DsatExamBundle["questionsById"] }
          | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Could not generate the next module.");
        }
        setBundle({
          modules: bundle.modules.map((m, i) => (i === nextIndex ? data.module : m)),
          questionsById: { ...bundle.questionsById, ...data.questionsById },
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not generate the next module.");
        advancingRef.current = false;
        setModuleTransitionLoading(false);
        return;
      }
      advancingRef.current = false;
      setModuleTransitionLoading(false);
    }
    advanceModule();
  };

  const handleExpire = () => {
    if (isLastModule) {
      finishExam();
    } else {
      void advanceToModule(currentModuleIndex + 1);
    }
  };

  const { formatted: timerFormatted } = useCountdown(currentModule?.durationSeconds ?? 0, {
    onExpire: handleExpire,
    paused: !currentModule || examFinished || moduleTransitionLoading,
  });

  const navigatorItems = useMemo(
    () =>
      currentModule
        ? currentModule.questionIds.map((qid) => ({
            questionId: qid,
            answered: Boolean(answers[qid]),
            flagged: Boolean(flagged[qid]),
          }))
        : [],
    [currentModule, answers, flagged],
  );

  const handleNext = () => {
    if (!currentModule) return;
    if (isLastQuestionInModule) {
      if (isLastModule) {
        finishExam();
      } else {
        void advanceToModule(currentModuleIndex + 1);
      }
    } else {
      nextQuestion(currentModule.questionIds.length);
    }
  };

  const nextLabel = isLastQuestionInModule ? (isLastModule ? "Submit Exam" : "Next Module") : "Next";

  if (examFinished) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <CheckCircle2 size={48} className="text-dsat" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground">Exam Submitted</h1>
        <p className="max-w-sm text-sm text-foreground-muted">
          Your responses have been recorded. Full scoring and adaptive module selection will be handled by the Orchestrator
          Agent in Phase 2.
        </p>
        <Button accent="dsat" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <X size={40} className="text-dsat" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground">Couldn&apos;t load this exam</h1>
        <p className="max-w-sm text-sm text-foreground-muted">{loadError}</p>
        <Button accent="dsat" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (moduleTransitionLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Preparing your next module…" />
      </div>
    );
  }

  if (!bundle || !currentModule || !currentQuestion || !currentQuestionId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Loading your exam…" />
      </div>
    );
  }

  const selectedChoiceId = answers[currentQuestionId];
  const eliminatedChoiceIds = eliminated[currentQuestionId] ?? [];

  const questionPane = (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground-muted">
          Question {currentQuestionIndex + 1}
        </span>
      </div>
      <p className="text-base leading-relaxed text-foreground">{currentQuestion.prompt}</p>
      <div className="flex flex-col gap-2.5">
        {currentQuestion.choices.map((choice, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = selectedChoiceId === choice.id;
          const isEliminated = eliminatedChoiceIds.includes(choice.id);

          return (
            <div key={choice.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (eliminatorMode) {
                    toggleEliminated(currentQuestionId, choice.id);
                  } else if (!isEliminated) {
                    selectAnswer(currentQuestionId, choice.id);
                  }
                }}
                disabled={!eliminatorMode && isEliminated}
                className={cn(
                  "flex flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  isSelected
                    ? "border-dsat bg-dsat-soft text-foreground"
                    : "border-border bg-surface hover:bg-surface-muted",
                  isEliminated && !eliminatorMode && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    isSelected ? "border-dsat bg-dsat text-white" : "border-border text-foreground-muted",
                  )}
                >
                  {letter}
                </span>
                <span className={cn(isEliminated && "line-through decoration-2")}>{choice.text}</span>
              </button>
              {isEliminated && !eliminatorMode && (
                <button
                  type="button"
                  onClick={() => toggleEliminated(currentQuestionId, choice.id)}
                  aria-label={`Undo elimination of choice ${letter}`}
                  className="rounded p-1 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <BluebookLayout
      title={currentModule.title}
      accent="dsat"
      studentName={studentName}
      onExit={() => router.push("/dashboard")}
      timerFormatted={timerFormatted}
      timerHidden={timerHidden}
      onToggleTimerHidden={toggleTimerHidden}
      directionsOpen={directionsOpen}
      onToggleDirections={toggleDirections}
      directionsText={DIRECTIONS[currentModule.domain] ?? DIRECTIONS.Math}
      showCalculatorButton={currentModule.domain === "Math"}
      calculatorOpen={calculatorOpen}
      onToggleCalculator={toggleCalculator}
      eliminatorMode={eliminatorMode}
      onToggleEliminatorMode={toggleEliminatorMode}
      navigatorOpen={navigatorOpen}
      onToggleNavigator={toggleNavigator}
      navigatorItems={navigatorItems}
      currentIndex={currentQuestionIndex}
      onSelectQuestion={goToQuestion}
      flagged={Boolean(flagged[currentQuestionId])}
      onToggleFlag={() => toggleFlag(currentQuestionId)}
      onBack={prevQuestion}
      onNext={handleNext}
      backDisabled={currentQuestionIndex === 0}
      nextLabel={nextLabel}
    >
      {currentQuestion.passage ? (
        <SplitScreen
          left={<p className="whitespace-pre-line text-base leading-relaxed text-foreground">{currentQuestion.passage}</p>}
          right={questionPane}
        />
      ) : (
        <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 sm:p-8">{questionPane}</div>
      )}

      <AnimatePresence>
        {calculatorOpen && currentModule.domain === "Math" && (
          <motion.div key="calculator">
            <CalculatorModal onClose={toggleCalculator} />
          </motion.div>
        )}
      </AnimatePresence>
    </BluebookLayout>
  );
}
