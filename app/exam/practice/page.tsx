"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { SkillPracticeQuiz } from "@/components/exam/SkillPracticeQuiz";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useExamTheme } from "@/hooks/useExamTheme";
import { useResetOnKeyChange } from "@/hooks/useResetOnKeyChange";
import type { ExamType, Question } from "@/lib/types";
import { accentForExam } from "@/lib/utils/accent";

function PracticeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examType = searchParams.get("exam") as ExamType | null;
  const domains = searchParams.getAll("domain");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useExamTheme(examType ? accentForExam(examType) : null);

  useResetOnKeyChange(`${examType ?? ""}|${domains.join(",")}`, () => {
    if (!examType || domains.length === 0) return;
    setQuestions(null);
    setLoadError(null);
  });

  useEffect(() => {
    if (!examType || domains.length === 0) return;
    const params = new URLSearchParams({ examType });
    domains.forEach((domain) => params.append("domain", domain));
    fetch(`/api/exam/questions?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as { questions: Question[] } | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Could not generate practice questions.");
        }
        setQuestions(data.questions);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not generate practice questions.");
      });
  }, [examType, domains.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!examType || domains.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-foreground-muted">No exam or domain was specified.</p>
        <Button accent="neutral" onClick={() => router.push("/select-exam")}>
          Choose a skill to practice
        </Button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-foreground-muted">{loadError}</p>
        <Button accent="neutral" onClick={() => router.push("/select-exam")}>
          Back to exam picker
        </Button>
      </div>
    );
  }

  if (!questions) {
    return <Spinner label="Loading practice questions…" />;
  }

  return (
    <SkillPracticeQuiz
      title={`${examType} · ${domains.join(" & ")}`}
      questions={questions}
      accent={accentForExam(examType)}
    />
  );
}

export default function PracticePage() {
  const router = useRouter();
  return (
    <div className="flex h-screen min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <h1 className="text-sm font-semibold text-foreground sm:text-base">Skill Practice</h1>
        <Button variant="ghost" size="sm" onClick={() => router.push("/select-exam")}>
          Exit
        </Button>
      </header>
      <main className="flex-1 overflow-y-auto bg-[var(--accent-current-wash)] p-4 transition-colors duration-300 sm:p-8">
        <div className="mx-auto w-full max-w-2xl">
          <PageTransition>
            <Suspense fallback={<Spinner label="Loading…" />}>
              <PracticeContent />
            </Suspense>
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
