"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ExamSourceUploader } from "@/components/exam/ExamSourceUploader";
import { PageTransition } from "@/components/layout/PageTransition";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Spinner } from "@/components/ui/Spinner";
import { useExamTheme } from "@/hooks/useExamTheme";
import { EXAM_META, EXAM_TYPES } from "@/lib/examMeta";
import type { ExamType, PracticeMode, SkillDomain, UploadedExam } from "@/lib/types";
import { accentForExam } from "@/lib/utils/accent";

const MODE_DESCRIPTIONS: Record<PracticeMode, string> = {
  "Full Exam": "Simulate the complete timed exam experience.",
  "Skill Practice": "Drill a specific sub-skill until it clicks.",
  "Upload Exam": "Upload a past test or paste a URL to build a new exam.",
  "Killing Questions": "Fresh questions targeting your weakest skills.",
};

function buildHref(examType: ExamType, mode: PracticeMode, domain?: SkillDomain): string {
  if (examType === "DSAT") {
    if (mode === "Full Exam") return "/exam/dsat";
    return `/exam/practice?exam=DSAT&domain=${encodeURIComponent(domain ?? "Math")}`;
  }
  if (examType === "AP") {
    if (mode === "Full Exam") return "/exam/ap";
    return `/exam/practice?exam=AP&domain=${encodeURIComponent(domain ?? "Calculus")}`;
  }
  // IELTS
  if (mode === "Full Exam") return "/exam/ielts";
  if (domain === "Listening" || domain === "Speaking") {
    return `/exam/ielts?section=${encodeURIComponent(domain)}`;
  }
  return `/exam/practice?exam=IELTS&domain=${encodeURIComponent(domain ?? "Reading")}`;
}

function SelectExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [examType, setExamType] = useState<ExamType | null>(null);
  const [mode, setMode] = useState<PracticeMode | null>(null);

  useEffect(() => {
    const preselect = searchParams.get("exam");
    if (preselect === "DSAT" || preselect === "AP" || preselect === "IELTS") {
      setExamType(preselect);
    }
  }, [searchParams]);

  // Once the student picks an exam, the rest of this flow (mode picker, domain picker) leans
  // into that exam's color everywhere shared chrome reads --accent-current (see TopNav).
  useExamTheme(examType ? accentForExam(examType) : null);

  if (!examType) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {EXAM_TYPES.map((type) => {
          const accent = accentForExam(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => setExamType(type)}
              className="text-left"
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <span
                  className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: `var(--accent-${accent}-soft)`, color: `var(--accent-${accent})` }}
                >
                  {type[0]}
                </span>
                <h2 className="text-lg font-semibold text-foreground">{EXAM_META[type].label}</h2>
                <p className="mt-1 text-sm text-foreground-muted">{EXAM_META[type].description}</p>
              </Card>
            </button>
          );
        })}
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-[var(--accent-current-wash)] p-4 transition-colors duration-300 sm:p-6">
        <button
          type="button"
          onClick={() => setExamType(null)}
          className="flex w-fit items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </button>
        <h1 className="text-xl font-semibold text-foreground">{EXAM_META[examType].label}</h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["Full Exam", "Skill Practice", "Upload Exam"] as PracticeMode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className="text-left">
              <Card className="h-full transition-shadow hover:shadow-md">
                <h2 className="text-base font-semibold text-foreground">{m}</h2>
                <p className="mt-1 text-sm text-foreground-muted">{MODE_DESCRIPTIONS[m]}</p>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "Full Exam") {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-[var(--accent-current-wash)] p-4 transition-colors duration-300 sm:p-6">
        <button
          type="button"
          onClick={() => setMode(null)}
          className="flex w-fit items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </button>
        <p className="text-foreground-muted">Ready to start your {EXAM_META[examType].label} full exam?</p>
        <LinkButton href={buildHref(examType, mode)} accent={accentForExam(examType)} size="lg">
          Start Full Exam
        </LinkButton>
      </div>
    );
  }

  if (mode === "Upload Exam") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-[var(--accent-current-wash)] p-4 transition-colors duration-300 sm:p-6">
        <button
          type="button"
          onClick={() => setMode(null)}
          className="flex w-fit items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </button>
        <h1 className="text-xl font-semibold text-foreground">Upload a past {EXAM_META[examType].label} test</h1>
        <p className="text-sm text-foreground-muted">
          We&apos;ll build it into a new full, timed exam and embed it here — just like the exams built by the AI.
        </p>
        <ExamSourceUploader
          examType={examType}
          onCreated={(exam: UploadedExam) => router.push(`/exam/upload/${exam.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[var(--accent-current-wash)] p-4 transition-colors duration-300 sm:p-6">
      <button
        type="button"
        onClick={() => setMode(null)}
        className="flex w-fit items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back
      </button>
      <h1 className="text-xl font-semibold text-foreground">Choose a skill area</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {EXAM_META[examType].domains.map((domain) => (
          <Card key={domain} className="flex items-center justify-between">
            <span className="font-medium text-foreground">{domain}</span>
            <LinkButton href={buildHref(examType, mode, domain)} accent={accentForExam(examType)} size="sm">
              Practice
            </LinkButton>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function SelectExamPage() {
  return (
    <PageTransition>
      <Suspense fallback={<Spinner label="Loading…" />}>
        <SelectExamContent />
      </Suspense>
    </PageTransition>
  );
}
