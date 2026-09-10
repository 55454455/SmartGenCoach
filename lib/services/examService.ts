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
// EXAM_ATTEMPTS is a fixed demo history tagged with DEMO_USER.id — filtering by the real caller's
// id means anyone other than that demo account (i.e. every real signed-up user) correctly gets an
// empty array, which is what should show a first-time-login empty state rather than someone else's
// numbers.
export async function getExamAttempts(userId: string, examType?: ExamType): Promise<ExamAttempt[]> {
  await simulateLatency(200);
  const attempts = EXAM_ATTEMPTS.filter((a) => a.userId === userId && (!examType || a.examType === examType));
  return [...attempts].sort((a, b) => new Date(a.dateTaken).getTime() - new Date(b.dateTaken).getTime());
}

export async function getLatestAttempt(userId: string, examType: ExamType): Promise<ExamAttempt | undefined> {
  const attempts = await getExamAttempts(userId, examType);
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

const DIFFICULTY_RANK: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };

// A stable sort, so within one difficulty tier questions keep whatever order they arrived in.
function sortByDifficulty(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
}

// Bounds how many Claude calls run at once across DSAT generation — see buildDsatCallGroups for
// why a Full Exam load only ever produces 4 groups total (so this cap lets them all run in one
// wave), and why that's an improvement over one call per content domain.
const MAX_CONCURRENT_DSAT_GENERATIONS = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface DsatCallGroup {
  domain: DsatDomain;
  slots: SkillSlot[];
}

const DSAT_SKILL_CONTENT_DOMAIN = new Map(
  SKILL_CATALOG.filter((s): s is typeof s & { contentDomain: string } => s.examType === "DSAT" && Boolean(s.contentDomain)).map((s) => [
    s.skillId,
    s.contentDomain,
  ]),
);

// Folds College Board's 4 official content domains into 2 Claude calls per module (paired in the
// order DSAT_CONTENT_DOMAIN_TARGETS lists them) instead of 1 call per content domain. A Full Exam
// load fires both sections' Module 1s together, so 1-call-per-domain would mean 8 simultaneous
// requests — a real risk of tripping Anthropic's concurrent-request rate limits where 2 never
// would have. Pairing keeps it to 4 total (one wave under the concurrency cap above) while each
// call still stays well under the size that risked truncating a single 20+ question response.
function buildDsatCallGroups(domain: DsatDomain): DsatCallGroup[] {
  const targets = DSAT_CONTENT_DOMAIN_TARGETS[domain];
  const groups: DsatCallGroup[] = [];
  for (let i = 0; i < targets.length; i += 2) {
    const slots: SkillSlot[] = targets.slice(i, i + 2).flatMap(({ contentDomain, count }) => {
      const pool = SKILL_CATALOG.filter(
        (s) => s.examType === "DSAT" && s.domain === domain && s.contentDomain === contentDomain,
      );
      return Array.from({ length: count }, (_, j) => {
        const skill = pool[j % pool.length];
        return { skillId: skill.skillId, skillName: skill.skillName };
      });
    });
    groups.push({ domain, slots });
  }
  return groups;
}

async function runDsatCallGroups(groups: DsatCallGroup[], difficulty: Difficulty | "Mixed"): Promise<Question[][]> {
  return mapWithConcurrency(groups, MAX_CONCURRENT_DSAT_GENERATIONS, (group) =>
    generateExamQuestions({
      examType: "DSAT",
      domain: group.domain,
      slots: group.slots,
      difficulty,
      idPrefix: makeIdPrefix("DSAT", group.domain),
      // Grid-in ("student-produced response") is a Math-only format on the real Digital SAT.
      allowGridIn: group.domain === "Math",
    }),
  );
}

const DSAT_PRETEST_COUNT_PER_MODULE = 2;

// Real Bluebook embeds 2 unscored "pretest" items per module, indistinguishable to the student
// from the scored ones, that count toward neither adaptive routing nor the final score. Applied
// after ordering so marking them doesn't disturb the official block order / easy-to-hard
// sequencing above — they're tagged in place, never moved or flagged in the UI.
function markPretestQuestions(questions: Question[]): Question[] {
  const pretestIndices = new Set<number>();
  while (pretestIndices.size < Math.min(DSAT_PRETEST_COUNT_PER_MODULE, questions.length)) {
    pretestIndices.add(Math.floor(Math.random() * questions.length));
  }
  return questions.map((q, i) => ({ ...q, scored: !pretestIndices.has(i) }));
}

// Re-orders a flat set of Reading and Writing questions into College Board's fixed content-domain
// block order (see DSAT_CONTENT_DOMAIN_TARGETS), each block sequenced easiest to hardest — grouped
// by each question's own skill's content domain, not by which Claude call produced it, since
// buildDsatCallGroups above combines two content domains into each call.
function orderReadingWritingQuestions(questions: Question[]): Question[] {
  const byContentDomain = new Map<string, Question[]>();
  for (const q of questions) {
    const cd = DSAT_SKILL_CONTENT_DOMAIN.get(q.skillId) ?? "unknown";
    const bucket = byContentDomain.get(cd);
    if (bucket) bucket.push(q);
    else byContentDomain.set(cd, [q]);
  }
  return DSAT_CONTENT_DOMAIN_TARGETS["Reading and Writing"].flatMap(({ contentDomain }) =>
    sortByDifficulty(byContentDomain.get(contentDomain) ?? []),
  );
}

// Math has no content-domain blocking — domains are intermixed — but the module as a whole is
// still sequenced roughly easiest to hardest.
function orderDsatModuleQuestions(domain: DsatDomain, questions: Question[]): Question[] {
  return domain === "Reading and Writing" ? orderReadingWritingQuestions(questions) : sortByDifficulty(questions);
}

// Generates one DSAT module's full, real Bluebook-count question set (27 for Reading and Writing,
// 22 for Math), matching College Board's official content-domain mix via DSAT_CONTENT_DOMAIN_TARGETS.
// Used for a single domain's Module 2 (getAdaptiveDsatModule2), where only 2 groups are ever in
// flight at once — well under the concurrency cap above.
async function generateDsatModuleQuestions(domain: DsatDomain, difficulty: Difficulty | "Mixed"): Promise<Question[]> {
  const results = await runDsatCallGroups(buildDsatCallGroups(domain), difficulty);
  return markPretestQuestions(orderDsatModuleQuestions(domain, results.flat()));
}

export interface DsatExamBundle {
  modules: ExamModule[];
  questionsById: Record<string, Question>;
}

// Real Claude-generated Module 1 for each DSAT domain (Reading and Writing, Math) — every student
// gets the same baseline module, so "Mixed" difficulty (a natural Easy/Medium/Hard spread, then
// sequenced easiest to hardest by generateDsatModuleQuestions) mirrors Bluebook's actual Module 1
// more closely than a single uniform difficulty would. Each domain's Module 2 comes back as an
// empty placeholder here; the client fetches its real content from getAdaptiveDsatModule2 once
// Module 1 for that domain is scored, so its difficulty can react to that student's own Module 1
// performance (genuine multistage adaptive testing, not just AI-generated-but-static content).
export async function getDsatExamBundle(): Promise<DsatExamBundle> {
  // Both sections' Module 1 groups share one concurrency-capped pool — 2 groups per section, 4
  // total, all fit in a single wave under MAX_CONCURRENT_DSAT_GENERATIONS.
  const rwGroups = buildDsatCallGroups("Reading and Writing");
  const mathGroups = buildDsatCallGroups("Math");
  const allResults = await runDsatCallGroups([...rwGroups, ...mathGroups], "Mixed");
  const rwQuestions = markPretestQuestions(
    orderDsatModuleQuestions("Reading and Writing", allResults.slice(0, rwGroups.length).flat()),
  );
  const mathQuestions = markPretestQuestions(orderDsatModuleQuestions("Math", allResults.slice(rwGroups.length).flat()));

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
