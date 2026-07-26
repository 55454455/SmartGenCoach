"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { SmartStudioQuiz } from "@/components/exam/SmartStudioQuiz";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useExamTheme } from "@/hooks/useExamTheme";
import type { SmartStudioTest } from "@/lib/types";

export default function SmartStudioTestPage() {
  const params = useParams<{ id: string }>();
  const [test, setTest] = useState<SmartStudioTest | null | undefined>(undefined);

  useExamTheme("studio");

  useEffect(() => {
    let active = true;
    fetch(`/api/smart-studio/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SmartStudioTest | null) => {
        if (active) setTest(data);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <PageTransition>
      {test === undefined ? (
        <Spinner label="Loading test…" />
      ) : test === null ? (
        <Card className="py-10 text-center text-foreground-muted">
          Couldn&apos;t find that test.{" "}
          <Link href="/smart-studio" className="font-medium text-studio hover:underline">
            Back to Smart Studio
          </Link>
        </Card>
      ) : (
        <SmartStudioQuiz test={test} />
      )}
    </PageTransition>
  );
}
