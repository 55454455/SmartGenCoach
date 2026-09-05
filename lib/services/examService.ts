import {
  AP_MODULES,
  DSAT_CONTENT_DOMAIN_TARGETS,
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
  DsatDomain,
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

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Generates one DSAT module's full, real Bluebook-count question set (27 for Reading and Writing,
// 22 for Math), matching College Board's official content-domain mix via DSAT_CONTENT_DOMAIN_TARGETS
// — one Claude call per content domain (fired in parallel, so wall-clock time stays close to a
// single call) rather than one call for the whole module, which also keeps each individual request
// small enough to avoid truncating a 20+ question response. The result is shuffled before it's
// returned since a real module interleaves content domains rather than grouping them.
async function generateDsatModuleQuestions(domain: DsatDomain, difficulty: Difficulty): Promise<Question[]> {
  const targets = DSAT_CONTENT_DOMAIN_TARGETS[domain];
  const buckets = await Promise.all(
    targets.map(({ contentDomain, count }) => {
      const pool = SKILL_CATALOG.filter(
        (s) => s.examType === "DSAT" && s.domain === domain && s.contentDomain === contentDomain,
      );
      const slots: SkillSlot[] = Array.from({ length: count }, (_, i) => {
        const skill = pool[i % pool.length];
        return { skillId: skill.skillId, skillName: skill.skillName };
      });
      return generateExamQuestions({ examType: "DSAT", domain, slots, difficulty, idPrefix: makeIdPrefix("DSAT", domain) });
    }),
  );
  return shuffle(buckets.flat());
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
  const [rwQuestions, mathQuestions] = await Promise.all([
    generateDsatModuleQuestions("Reading and Writing", "Medium"),
    generateDsatModuleQuestions("Math", "Medium"),
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

// Bluebook routes Module 2 down exactly one of two paths — a harder module or an easier one —
// based on Module 1 performance; it is not a 3-way Easy/Medium/Hard split. College Board's real
// routing uses an undisclosed IRT-based ability estimate, not a published percentage cutoff, so
// this threshold approximates the real behavior rather than replicating an official number.
function routeModule2Difficulty(correctCount: number, total: number): Difficulty {
  if (total <= 0) return "Hard"; // no Module 1 data — unreachable in practice, default to the standard path
  return correctCount / total >= 0.6 ? "Hard" : "Easy";
}

// The adaptive step: Module 2's difficulty for a domain is derived from the student's own Module 1
// performance in that same domain — strong Module 1 -> harder Module 2, weak Module 1 -> easier
// Module 2 — exactly like the real digital SAT's multistage adaptive design. Module 2 gets the same
// real question count and content-domain mix as Module 1 (Bluebook doesn't shrink Module 2).
export async function getAdaptiveDsatModule2(params: {
  domain: DsatDomain;
  correctCount: number;
  total: number;
}): Promise<AdaptiveDsatModuleResult> {
  const { domain, correctCount, total } = params;
  const template = DSAT_MODULES.find((m) => m.domain === domain && m.id.endsWith("module-2"));
  if (!template) throw new Error(`No Module 2 template found for domain "${domain}".`);

  const difficulty = routeModule2Difficulty(correctCount, total);
  const questions = await generateDsatModuleQuestions(domain, difficulty);

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
