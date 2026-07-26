import { READINESS_THRESHOLDS } from "@/lib/mockData";
import type { ExamType, ReadinessReport } from "@/lib/types";
import { simulateLatency } from "./simulateLatency";
import { getLatestSkillScores } from "./skillService";

const EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

// PHASE2: readiness scoring is computed by the Orchestrator Agent from full attempt history + agent confidence.
function computeReadinessScore(errorRates: number[]): number {
  if (errorRates.length === 0) return 0;
  const avgError = errorRates.reduce((sum, e) => sum + e, 0) / errorRates.length;
  return Math.round((1 - avgError) * 100);
}

export async function getReadinessReport(examType: ExamType): Promise<ReadinessReport> {
  await simulateLatency(200);
  const allSkills = await getLatestSkillScores(examType);
  const readinessScore = computeReadinessScore(allSkills.map((s) => s.errorRate));
  const weakestSkills = [...allSkills].sort((a, b) => b.errorRate - a.errorRate).slice(0, 5);
  const threshold = READINESS_THRESHOLDS[examType];
  return {
    examType,
    readinessScore,
    threshold,
    unlocked: readinessScore >= threshold,
    weakestSkills,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getAllReadinessReports(): Promise<ReadinessReport[]> {
  return Promise.all(EXAM_TYPES.map((examType) => getReadinessReport(examType)));
}
