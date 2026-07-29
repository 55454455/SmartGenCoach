import type { ExamType } from "@/lib/types";

export type Accent = "dsat" | "ap" | "ielts" | "studio" | "party" | "neutral";

export function accentForExam(examType: ExamType): Accent {
  if (examType === "DSAT") return "dsat";
  if (examType === "AP") return "ap";
  return "ielts";
}
