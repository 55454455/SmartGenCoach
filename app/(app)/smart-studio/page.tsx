"use client";

import { FileText, Image as ImageIcon, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { SmartStudioUploader } from "@/components/exam/SmartStudioUploader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useExamTheme } from "@/hooks/useExamTheme";
import type { SmartStudioTest } from "@/lib/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function SmartStudioPage() {
  const [tests, setTests] = useState<SmartStudioTest[] | null>(null);

  useExamTheme("studio");

  useEffect(() => {
    fetch("/api/smart-studio")
      .then((res) => res.json())
      .then((data: SmartStudioTest[]) => setTests(data));
  }, []);

  return (
    <PageTransition className="rounded-2xl bg-[var(--accent-current-wash)] transition-colors duration-300 sm:p-2">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Sparkles size={22} className="text-studio" aria-hidden="true" />
            Smart Studio
          </h1>
          <p className="mt-1 text-foreground-muted">
            Upload any test paper — a document, photo, or screenshot — and Smart Studio recognizes the questions,
            lets you take it, grades your answers question-by-question with explanations, and generates a full
            answer key.
          </p>
        </div>

        <SmartStudioUploader onUploaded={(test) => setTests((prev) => [test, ...(prev ?? [])])} />

        {!tests ? (
          <Spinner label="Loading your uploaded tests…" />
        ) : tests.length === 0 ? (
          <Card className="py-10 text-center text-foreground-muted">No tests uploaded yet — try one above.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {tests.map((test) => {
              const Icon = test.fileType.startsWith("image/") ? ImageIcon : FileText;
              return (
                <Card key={test.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-studio-soft text-studio">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{test.detectedTitle}</p>
                      <p className="text-xs text-foreground-muted">
                        {test.fileName} · {formatFileSize(test.fileSizeBytes)} · uploaded {formatDate(test.uploadedAt)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge accent="studio">{test.questions.length} questions</Badge>
                        {test.lastResult && (
                          <Badge accent="neutral">
                            Last score: {test.lastResult.score}/{test.lastResult.total}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col md:flex-row">
                    <Link href={`/smart-studio/${test.id}`}>
                      <Button accent="studio" size="sm">
                        {test.lastResult ? "Retake" : "Take test"}
                      </Button>
                    </Link>
                    <Link href={`/smart-studio/${test.id}/answer-key`}>
                      <Button accent="studio" variant="secondary" size="sm" icon={<KeyRound size={14} aria-hidden="true" />}>
                        Answer key
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
