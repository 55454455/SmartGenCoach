import {
  AP_MODULES,
  DSAT_MODULES,
  EXAM_ATTEMPTS,
  IELTS_LISTENING_AUDIO_DURATION_SECONDS,
  IELTS_LISTENING_CUES,
  IELTS_LISTENING_TRANSCRIPT,
  IELTS_SPEAKING_PROMPTS,
  QUESTION_BY_ID,
  SKILL_CATALOG,
} from "@/lib/mockData";
import type {
  Difficulty,
  ExamAttempt,
  ExamModule,
  ExamType,
  ListeningCue,
  Question,
  SkillDomain,
  SpeakingPrompt,
} from "@/lib/types";
import { generateExamQuestions, type SkillSlot } from "./examQuestionGenerator";
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

// Cycles through every catalogued skill for this exam/domain so a request for more questions than
// there are distinct skills just repeats skills round-robin rather than erroring.
function skillSlotsForDomain(examType: ExamType, domain: SkillDomain, count: number): SkillSlot[] {
  const pool = SKILL_CATALOG.filter((s) => s.examType === examType && s.domain === domain);
  if (pool.length === 0) {
    return Array.from({ length: count }, () => ({ skillId: `${examType}-${domain}-general`, skillName: domain }));
  }
  return Array.from({ length: count }, (_, i) => {
    const skill = pool[i % pool.length];
    return { skillId: skill.skillId, skillName: skill.skillName };
  });
}

function makeIdPrefix(examType: ExamType, domain: SkillDomain): string {
  const slug = domain.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `q-${examType.toLowerCase()}-${slug}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

export interface DsatExamBundle {
  modules: ExamModule[];
  questionsById: Record<string, Question>;
}

// Real Claude-generated Module 1 for each DSAT domain (Reading and Writing, Math), always at
// Medium difficulty — mirrors Bluebook, where every student's first module starts at the same
// baseline difficulty. Each domain's Module 2 comes back as an empty placeholder here; the client
// fetches its real content from getAdaptiveDsatModule2 once Module 1 for that domain is scored, so
// its difficulty can react to that student's own Module 1 performance (genuine multistage adaptive
// testing, not just AI-generated-but-static content).
export async function getDsatExamBundle(): Promise<DsatExamBundle> {
  const rwModule1Template = DSAT_MODULES.find((m) => m.id === "dsat-rw-module-1")!;
  const mathModule1Template = DSAT_MODULES.find((m) => m.id === "dsat-math-module-1")!;

  const [rwQuestions, mathQuestions] = await Promise.all([
    generateExamQuestions({
      examType: "DSAT",
      domain: "Reading and Writing",
      slots: skillSlotsForDomain("DSAT", "Reading and Writing", rwModule1Template.questionIds.length),
      difficulty: "Medium",
      idPrefix: makeIdPrefix("DSAT", "Reading and Writing"),
    }),
    generateExamQuestions({
      examType: "DSAT",
      domain: "Math",
      slots: skillSlotsForDomain("DSAT", "Math", mathModule1Template.questionIds.length),
      difficulty: "Medium",
      idPrefix: makeIdPrefix("DSAT", "Math"),
    }),
  ]);

  const questionsById: Record<string, Question> = {};
  for (const q of [...rwQuestions, ...mathQuestions]) questionsById[q.id] = q;

  const modules: ExamModule[] = DSAT_MODULES.map((mod) => {
    if (mod.id === "dsat-rw-module-1") return { ...mod, questionIds: rwQuestions.map((q) => q.id) };
    if (mod.id === "dsat-math-module-1") return { ...mod, questionIds: mathQuestions.map((q) => q.id) };
    return { ...mod, questionIds: [] }; // dsat-rw-module-2 / dsat-math-module-2 — generated adaptively.
  });

  return { modules, questionsById };
}

export interface AdaptiveDsatModuleResult {
  module: ExamModule;
  questionsById: Record<string, Question>;
}

function difficultyFromPerformance(correctCount: number, total: number): Difficulty {
  if (total <= 0) return "Medium";
  const ratio = correctCount / total;
  if (ratio >= 0.75) return "Hard";
  if (ratio >= 0.4) return "Medium";
  return "Easy";
}

// The adaptive step: Module 2's difficulty for a domain is derived from the student's own Module 1
// performance in that same domain — strong Module 1 -> harder Module 2, weak Module 1 -> easier
// Module 2 — exactly like the real digital SAT's multistage adaptive design.
export async function getAdaptiveDsatModule2(params: {
  domain: "Math" | "Reading and Writing";
  correctCount: number;
  total: number;
}): Promise<AdaptiveDsatModuleResult> {
  const { domain, correctCount, total } = params;
  const template = DSAT_MODULES.find((m) => m.domain === domain && m.id.endsWith("module-2"));
  if (!template) throw new Error(`No Module 2 template found for domain "${domain}".`);

  const difficulty = difficultyFromPerformance(correctCount, total);
  const questions = await generateExamQuestions({
    examType: "DSAT",
    domain,
    slots: skillSlotsForDomain("DSAT", domain, template.questionIds.length),
    difficulty,
    idPrefix: makeIdPrefix("DSAT", domain),
  });

  const questionsById: Record<string, Question> = {};
  for (const q of questions) questionsById[q.id] = q;

  return { module: { ...template, questionIds: questions.map((q) => q.id) }, questionsById };
}

export interface ApExamBundle {
  modules: ExamModule[];
  questionsById: Record<string, Question>;
}

// AP has one module per subject (no Bluebook-style multistage structure), so this is a
// straightforward real generation call per subject rather than an adaptive two-stage flow.
export async function getApExamBundle(): Promise<ApExamBundle> {
  const perModuleQuestions = await Promise.all(
    AP_MODULES.map((mod) =>
      generateExamQuestions({
        examType: "AP",
        domain: mod.domain,
        slots: skillSlotsForDomain("AP", mod.domain, mod.questionIds.length),
        difficulty: "Medium",
        idPrefix: makeIdPrefix("AP", mod.domain),
      }),
    ),
  );

  const questionsById: Record<string, Question> = {};
  const modules: ExamModule[] = AP_MODULES.map((mod, i) => {
    const questions = perModuleQuestions[i];
    for (const q of questions) questionsById[q.id] = q;
    return { ...mod, questionIds: questions.map((q) => q.id) };
  });

  return { modules, questionsById };
}

export interface IeltsListeningBundle {
  audioDurationSeconds: number;
  cues: ListeningCue[];
  questionsById: Record<string, Question>;
  transcript: string;
}

// Listening intentionally stays on the fixed scripted transcript: IELTS_LISTENING_CUES times each
// question to an exact sentence in IELTS_LISTENING_TRANSCRIPT (spoken aloud via the Web Speech
// API), so the questions must stay in lockstep with that fixed audio content.
// PHASE2: once a real generated/streamed audio asset exists, generate transcript + cues +
// questions together as one Speaking/English Agent call instead of pulling from a fixed script.
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

// Speaking is prompt-based, not multiple-choice, and the prompts double as the fixed prep/speak
// timer script — kept static for the same reason as Listening above.
export async function getIeltsSpeakingPrompts(): Promise<SpeakingPrompt[]> {
  await simulateLatency(200);
  return IELTS_SPEAKING_PROMPTS;
}

// Skill Practice: a fresh, real AI-generated question set for one domain. Unlike a timed Full Exam
// module, practice isn't staged by difficulty, so this asks for a natural mixed spread instead.
export async function getQuestionsByDomain(examType: ExamType, domain: SkillDomain, count = 6): Promise<Question[]> {
  return generateExamQuestions({
    examType,
    domain,
    slots: skillSlotsForDomain(examType, domain, count),
    difficulty: "Mixed",
    idPrefix: makeIdPrefix(examType, domain),
  });
}
