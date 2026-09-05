import type { ExamType, SkillScore } from "@/lib/types";
import { getLatestAttempt } from "./examService";

const EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

// PHASE2: replace with an aggregation query (or a Math/English/Speaking Agent summary) over full attempt history.
export async function getLatestSkillScores(userId: string, examType: ExamType): Promise<SkillScore[]> {
  const attempt = await getLatestAttempt(userId, examType);
  return attempt?.skillScores ?? [];
}

export async function getWeakestSkills(userId: string, examType: ExamType, limit = 5): Promise<SkillScore[]> {
  const scores = await getLatestSkillScores(userId, examType);
  return [...scores].sort((a, b) => b.errorRate - a.errorRate).slice(0, limit);
}

export async function getAllWeakestSkills(userId: string, limit = 5): Promise<SkillScore[]> {
  const all: SkillScore[] = [];
  for (const examType of EXAM_TYPES) {
    all.push(...(await getLatestSkillScores(userId, examType)));
  }
  return all.sort((a, b) => b.errorRate - a.errorRate).slice(0, limit);
}
