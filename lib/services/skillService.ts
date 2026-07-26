import type { ExamType, SkillScore } from "@/lib/types";
import { getLatestAttempt } from "./examService";

const EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

// PHASE2: replace with an aggregation query (or a Math/English/Speaking Agent summary) over full attempt history.
export async function getLatestSkillScores(examType: ExamType): Promise<SkillScore[]> {
  const attempt = await getLatestAttempt(examType);
  return attempt?.skillScores ?? [];
}

export async function getWeakestSkills(examType: ExamType, limit = 5): Promise<SkillScore[]> {
  const scores = await getLatestSkillScores(examType);
  return [...scores].sort((a, b) => b.errorRate - a.errorRate).slice(0, limit);
}

export async function getAllWeakestSkills(limit = 5): Promise<SkillScore[]> {
  const all: SkillScore[] = [];
  for (const examType of EXAM_TYPES) {
    all.push(...(await getLatestSkillScores(examType)));
  }
  return all.sort((a, b) => b.errorRate - a.errorRate).slice(0, limit);
}
