"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BluebookLayout } from "@/components/exam/BluebookLayout";
import { CalculatorModal } from "@/components/exam/CalculatorModal";
import { SplitScreen } from "@/components/exam/SplitScreen";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useCountdown } from "@/hooks/useCountdown";
import { useExamTheme } from "@/hooks/useExamTheme";
import type { UploadedExam } from "@/lib/types";
import { useAuthStore } from "@/lib/store/authStore";
import { useExamRunnerStore } from "@/lib/store/examRunnerStore";
import { accentForExam } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";

const DIRECTIONS: Partial<Record<string, string>> = {
  "Reading and Writing":
    "The passages in this section are followed by a question. Read each passage and then choose the best answer to the accompanying question. All questions are multiple-choice with four possible answers.",
  Math: "You may use a calculator for this module. All variables and expressions represent real numbers unless otherwise indicated. For multiple-choice questions, solve each problem and choose the best answer from the four choices provided.",
  Calculus: "You may use a calculator for this module. Solve each problem and choose the best answer from the four choices provided.",
  History: "Read each question carefully and choose the best answer from the four choices provided.",
  Reading: "Read each passage and question carefully, then choose the best answer from the four choices provided.",
  Listening: "Answer each question based on the audio excerpt it refers to, then choose the best answer from the four choices provided.",
};
const FALLBACK_DIRECTIONS = "Read each question carefully and choose the best answer from the four choices provided.";

const CHOICE_ACCENT: Record<"DSAT" | "AP" | "IELTS", { border: string; bg: string; dot: string; text: string }> = {
  DSAT: { border: "border-dsat", bg: "bg-dsat-soft", dot: "border-dsat bg-dsat", text: "text-dsat" },
  AP: { border: "border-ap", bg: "bg-ap-soft", dot: "border-ap bg-ap", text: "text-ap" },
  IELTS: { border: "border-ielts", bg: "bg-ielts-soft", dot: "border-ielts bg-ielts", text: "text-ielts" },
};

export default function UploadedExamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const studentName = useAuthStore((s) => s.session?.user.name) ?? "Student";
  const [exam, setExam] = useState<UploadedExam | null | undefined>(undefined);
  const [examFinished, setExamFinished] = useState(false);
  const resetOnce = useRef(false);

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
  } = useExamRunnerStore();

  useEffect(() => {
    if (resetOnce.current) return;
    resetOnce.current = true;
    reset();
    fetch(`/api/exam/upload/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UploadedExam | null) => setExam(data));
  }, [reset, params.id]);

  const accent = exam ? accentForExam(exam.examType) : "neutral";
  const choiceAccent = exam ? CHOICE_ACCENT[exam.examType] : CHOICE_ACCENT.DSAT;
  useExamTheme(exam ? accent : null);

  const currentModule = exam?.modules[currentModuleIndex];
  const currentQuestionId = currentModule?.questionIds[currentQuestionIndex];
  const currentQuestion = currentQuestionId ? exam?.questionsById[currentQuestionId] : undefined;

  const isLastModule = exam ? currentModuleIndex === exam.modules.length - 1 : false;
  const isLastQuestionInModule = currentModule ? currentQuestionIndex === currentModule.questionIds.length - 1 : false;

  const finishExam = () => setExamFinished(true);

  const handleExpire = () => {
    if (isLastModule) finishExam();
    else advanceModule();
  };

  const { formatted: timerFormatted } = useCountdown(currentModule?.durationSeconds ?? 0, {
    onExpire: handleExpire,
    paused: !currentModule || examFinished,
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
      if (isLastModule) finishExam();
      else advanceModule();
    } else {
      nextQuestion(currentModule.questionIds.length);
    }
  };

  const nextLabel = isLastQuestionInModule ? (isLastModule ? "Submit Exam" : "Next Module") : "Next";

  if (exam === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-foreground-muted">Couldn&apos;t find that uploaded exam.</p>
        <Button accent="neutral" onClick={() => router.push("/select-exam")}>
          Back to Select Exam
        </Button>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <CheckCircle2 size={48} className={choiceAccent.text} aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground">Exam Submitted</h1>
        <p className="max-w-sm text-sm text-foreground-muted">
          Your responses have been recorded. Full scoring and adaptive feedback will be handled by the Orchestrator Agent
          in Phase 2.
        </p>
        <Button accent={accent} onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!exam || !currentModule || !currentQuestion || !currentQuestionId) {
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
                    ? `${choiceAccent.border} ${choiceAccent.bg} text-foreground`
                    : "border-border bg-surface hover:bg-surface-muted",
                  isEliminated && !eliminatorMode && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    isSelected ? `${choiceAccent.dot} text-white` : "border-border text-foreground-muted",
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

  const showCalculator = currentModule.domain === "Math" || currentModule.domain === "Calculus";

  return (
    <BluebookLayout
      title={`${exam.detectedTitle} — ${currentModule.title}`}
      accent={accent}
      studentName={studentName}
      onExit={() => router.push("/dashboard")}
      timerFormatted={timerFormatted}
      timerHidden={timerHidden}
      onToggleTimerHidden={toggleTimerHidden}
      directionsOpen={directionsOpen}
      onToggleDirections={toggleDirections}
      directionsText={DIRECTIONS[currentModule.domain] ?? FALLBACK_DIRECTIONS}
      showCalculatorButton={showCalculator}
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
        {calculatorOpen && showCalculator && (
          <motion.div key="calculator">
            <CalculatorModal onClose={toggleCalculator} />
          </motion.div>
        )}
      </AnimatePresence>
    </BluebookLayout>
  );
}
