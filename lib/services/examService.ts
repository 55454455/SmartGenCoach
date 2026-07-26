import {
  AP_MODULES,
  DSAT_MODULES,
  EXAM_ATTEMPTS,
  IELTS_LISTENING_AUDIO_DURATION_SECONDS,
  IELTS_LISTENING_CUES,
  IELTS_LISTENING_TRANSCRIPT,
  IELTS_SPEAKING_PROMPTS,
  QUESTION_BANK,
  QUESTION_BY_ID,
} from "@/lib/mockData";
import type { ExamAttempt, ExamModule, ExamType, ListeningCue, Question, SkillDomain, SpeakingPrompt } from "@/lib/types";
import { simulateLatency } from "./simulateLatency";

// PHASE2: replace with a Supabase query filtered by user_id (+ exam_type), ordered by date_taken.
export async function getExamAttempts(examType?: ExamType): Promise<ExamAttempt[]> {
  await simulateLatency(200);
  const attempts = examType ? EXAM_ATTEMPTS.filter((a) => a.examType === examType) : EXAM_ATTEMPTS;
  return [...attempts].sort((a, b) => new Date(a.dateTaken).getTime() - new Date(b.dateTaken).getTime());
}

export async function getLatestAttempt(examType: ExamType): Promise<ExamAttempt | undefined> {
  const attempts = await getExamAttempts(examType);
  return attempts.at(-1);
}

export interface DsatExamBundle {
  modules: ExamModule[];
  questionsById: Record<string, Question>;
}

// PHASE2: replace with an Orchestrator Agent call that assembles an adaptive module set per student.
export async function getDsatExamBundle(): Promise<DsatExamBundle> {
  await simulateLatency(300);
  const questionsById: Record<string, Question> = {};
  for (const mod of DSAT_MODULES) {
    for (const qid of mod.questionIds) {
      const q = QUESTION_BY_ID.get(qid);
      if (q) questionsById[qid] = q;
    }
  }
  return { modules: DSAT_MODULES, questionsById };
}

export interface ApExamBundle {
  modules: ExamModule[];
  questionsById: Record<string, Question>;
}

// PHASE2: replace with an Orchestrator Agent call that assembles an adaptive module set per student.
export async function getApExamBundle(): Promise<ApExamBundle> {
  await simulateLatency(300);
  const questionsById: Record<string, Question> = {};
  for (const mod of AP_MODULES) {
    for (const qid of mod.questionIds) {
      const q = QUESTION_BY_ID.get(qid);
      if (q) questionsById[qid] = q;
    }
  }
  return { modules: AP_MODULES, questionsById };
}

export interface IeltsListeningBundle {
  audioDurationSeconds: number;
  cues: ListeningCue[];
  questionsById: Record<string, Question>;
  transcript: string;
}

// PHASE2: replace with a real generated/streamed audio asset + Speaking/English Agent question set.
export async function getIeltsListeningBundle(): Promise<IeltsListeningBundle> {
  await simulateLatency(300);
  const questionsById: Record<string, Question> = {};
  for (const cue of IELTS_LISTENING_CUES) {
    const q = QUESTION_BY_ID.get(cue.questionId);
    if (q) questionsById[cue.questionId] = q;
  }
  return {
    audioDurationSeconds: IELTS_LISTENING_AUDIO_DURATION_SECONDS,
    cues: IELTS_LISTENING_CUES,
    questionsById,
    transcript: IELTS_LISTENING_TRANSCRIPT,
  };
}

// PHASE2: prompts generated per-student by the Speaking Evaluator agent.
export async function getIeltsSpeakingPrompts(): Promise<SpeakingPrompt[]> {
  await simulateLatency(200);
  return IELTS_SPEAKING_PROMPTS;
}

export async function getQuestionsByDomain(examType: ExamType, domain: SkillDomain): Promise<Question[]> {
  await simulateLatency(250);
  return QUESTION_BANK.filter((q) => q.examType === examType && q.domain === domain);
}
