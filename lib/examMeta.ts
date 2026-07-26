import type { ExamType, SkillDomain } from "@/lib/types";

interface ExamMeta {
  label: string;
  description: string;
  domains: SkillDomain[];
}

export const EXAM_META: Record<ExamType, ExamMeta> = {
  DSAT: {
    label: "Digital SAT",
    description: "Adaptive, Bluebook-style Math and Reading & Writing modules.",
    domains: ["Math", "Reading and Writing"],
  },
  AP: {
    label: "AP Exams",
    description: "Calculus and US History practice sets.",
    domains: ["Calculus", "History"],
  },
  IELTS: {
    label: "IELTS",
    description: "Listening, Reading, Writing, and Speaking practice.",
    domains: ["Listening", "Reading", "Writing", "Speaking"],
  },
};

export const EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];
