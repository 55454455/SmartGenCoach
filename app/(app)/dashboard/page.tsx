"use client";

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Spinner } from "@/components/ui/Spinner";
import { StatChart } from "@/components/ui/StatChart";
import { useAuthStore } from "@/lib/store/authStore";
import { accentForExam } from "@/lib/utils/accent";
import type { ExamAttempt, ExamType, ReadinessReport, SkillScore } from "@/lib/types";

interface DashboardData {
  readiness: ReadinessReport[];
  attempts: ExamAttempt[];
  weakestSkills: SkillScore[];
}

const EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const userName = useAuthStore((s) => s.session?.user.name);

  useEffect(() => {
    let active = true;
    // PHASE2: this fetch call is the only thing that changes — the Orchestrator Agent
    // will populate the same DashboardData shape from live Supabase + agent state.
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json: DashboardData) => {
        if (active) setData(json);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return <Spinner label="Loading your dashboard…" />;
  }

  const { readiness, attempts, weakestSkills } = data;
  const firstName = userName?.split(" ")[0];

  return (
    <PageTransition>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome back{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-1 text-foreground-muted">Here&apos;s how your prep is trending across all three exams.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXAM_TYPES.map((examType) => {
            const report = readiness.find((r) => r.examType === examType);
            const examAttempts = attempts
              .filter((a) => a.examType === examType)
              .sort((a, b) => new Date(a.dateTaken).getTime() - new Date(b.dateTaken).getTime());
            const accent = accentForExam(examType);
            const latest = examAttempts.at(-1);
            const maxScore = latest?.maxScore ?? 100;

            return (
              <Card key={examType} className="flex flex-col gap-4">
                <CardHeader>
                  <CardTitle>{examType}</CardTitle>
                  <Badge accent={accent}>{report?.unlocked ? "Killing Qs unlocked" : "Locked"}</Badge>
                </CardHeader>

                <div className="flex items-center gap-4">
                  <ProgressRing
                    value={report?.readinessScore ?? 0}
                    accent={accent}
                    ariaLabel={`${examType} readiness score: ${report?.readinessScore ?? 0} percent`}
                  />
                  <div className="min-w-0 flex-1">
                    <StatChart
                      data={examAttempts.map((a) => ({
                        label: new Date(a.dateTaken).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                        value: a.scaledScore,
                      }))}
                      maxValue={maxScore}
                      accent={accent}
                      ariaLabel={`${examType} score over time`}
                    />
                  </div>
                </div>

                <p className="text-sm text-foreground-muted">
                  Latest score: <span className="font-semibold text-foreground">{latest?.scaledScore ?? "—"}</span> / {maxScore}
                </p>

                <LinkButton href={`/select-exam?exam=${examType}`} accent={accent} variant="secondary" size="sm" className="mt-auto">
                  Practice {examType}
                </LinkButton>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weakest Skills</CardTitle>
          </CardHeader>
          <ul className="flex flex-col divide-y divide-border">
            {weakestSkills.map((skill) => (
              <li
                key={`${skill.examType}-${skill.skillId}`}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge accent={accentForExam(skill.examType)}>{skill.examType}</Badge>
                    <span className="font-medium text-foreground">{skill.skillName}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {skill.correct}/{skill.attempted} correct · {Math.round(skill.errorRate * 100)}% error rate
                  </p>
                </div>
                <LinkButton
                  href={`/select-exam?exam=${skill.examType}`}
                  size="sm"
                  variant="secondary"
                  accent={accentForExam(skill.examType)}
                  className="self-start sm:self-auto"
                >
                  Practice this skill
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageTransition>
  );
}
