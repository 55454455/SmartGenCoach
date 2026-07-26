"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useExamTheme } from "@/hooks/useExamTheme";
import type { AnswerKeyEntry } from "@/lib/services/smartStudioService";
import type { SmartStudioTest } from "@/lib/types";

export default function SmartStudioAnswerKeyPage() {
  const params = useParams<{ id: string }>();
  const [test, setTest] = useState<SmartStudioTest | null>(null);
  const [answerKey, setAnswerKey] = useState<AnswerKeyEntry[] | null>(null);

  useExamTheme("studio");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/smart-studio/${params.id}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/smart-studio/${params.id}/answer-key`).then((res) => (res.ok ? res.json() : [])),
    ]).then(([testData, keyData]) => {
      if (active) {
        setTest(testData);
        setAnswerKey(keyData);
      }
    });
    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <KeyRound size={22} className="text-studio" aria-hidden="true" />
            Answer Key
          </h1>
          <p className="mt-1 text-foreground-muted">{test ? test.detectedTitle : "Loading…"}</p>
        </div>

        {!answerKey ? (
          <Spinner label="Generating answer key…" />
        ) : (
          <div className="flex flex-col gap-3">
            {answerKey.map((entry) => (
              <Card key={entry.questionId}>
                <div className="mb-2 flex items-start gap-2">
                  <Badge accent="studio">Q{entry.number}</Badge>
                  <p className="font-medium text-foreground">{entry.prompt}</p>
                </div>
                <p className="text-sm text-foreground">
                  Correct answer: <span className="font-semibold">{entry.correctText}</span>
                </p>
                <p className="mt-2 text-sm text-foreground-muted">{entry.explanation}</p>
              </Card>
            ))}
          </div>
        )}

        <Link href="/smart-studio" className="self-start text-sm font-medium text-studio hover:underline">
          Back to Smart Studio
        </Link>
      </div>
    </PageTransition>
  );
}
