// Shared contract between the frontend and the future Multi-Agent AI System + Supabase backend.
// PHASE2: these interfaces become the DB schema / agent I/O contract — keep them backend-agnostic.

export type ExamType = "DSAT" | "AP" | "IELTS";

export type DsatDomain = "Math" | "Reading and Writing";
export type ApDomain = "Calculus" | "History";
export type IeltsDomain = "Listening" | "Reading" | "Writing" | "Speaking";
export type SkillDomain = DsatDomain | ApDomain | IeltsDomain;

export type PracticeMode = "Full Exam" | "Skill Practice" | "Killing Questions" | "Upload Exam";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type Trend = "up" | "down" | "flat";

export type UserRole = "user" | "admin";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  createdAt: string; // ISO timestamp
  targetExams: ExamType[];
  targetScores: Partial<Record<ExamType, number>>;
  role: UserRole;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
  expiresAt: string; // ISO timestamp
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/** Aggregate mastery of one sub-skill, e.g. "Linear Equations" or "IELTS Fluency & Coherence". */
export interface SkillScore {
  skillId: string;
  skillName: string;
  domain: SkillDomain;
  examType: ExamType;
  correct: number;
  attempted: number;
  errorRate: number; // 0-1, derived from correct/attempted
  lastPracticed: string; // ISO timestamp
  trend: Trend;
}

/** Feedback simulated as if produced by a Phase 2 agent. */
export interface AgentFeedback {
  id: string;
  agentName: string; // e.g. "Orchestrator", "Math Agent", "English Agent", "Speaking Evaluator"
  summary: string;
  strengths: string[];
  weaknesses: string[];
  generatedAt: string; // ISO timestamp
}

export interface ExamAttempt {
  id: string;
  userId: string;
  examType: ExamType;
  mode: PracticeMode;
  domain?: SkillDomain;
  dateTaken: string; // ISO timestamp
  durationMinutes: number;
  scaledScore: number; // DSAT 400-1600 · AP 1-5 · IELTS band x10 (e.g. 7.5 -> 75)
  maxScore: number;
  rawCorrect: number;
  rawTotal: number;
  skillScores: SkillScore[];
  agentFeedback: AgentFeedback;
}

export interface AnswerChoice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  examType: ExamType;
  domain: SkillDomain;
  skillId: string;
  skillName: string;
  prompt: string;
  passage?: string;
  choices: AnswerChoice[];
  correctChoiceId: string;
  difficulty: Difficulty;
  explanation: string;
  /** e.g. "DSAT · Math" — a display-friendly grouping label, used by Let's Play's category badge. */
  category?: string;
  /** A short, category-tailored pattern/mental-trick/reading-skill tip, revealed alongside the
   *  correct answer. Populated by generateExamQuestions(); optional so older static question data
   *  (mockData.ts) stays valid without a migration. */
  tip?: string;
}

/** Drives the DSAT/AP module timers and the IELTS Listening/Reading sections. */
export interface ExamModule {
  id: string;
  title: string;
  domain: SkillDomain;
  durationSeconds: number;
  questionIds: string[];
}

/** Readiness gauge + "Killing Questions" unlock gate. */
export interface ReadinessReport {
  examType: ExamType;
  readinessScore: number; // 0-100
  threshold: number; // required readinessScore to unlock Killing Questions
  unlocked: boolean;
  weakestSkills: SkillScore[];
  lastUpdated: string; // ISO timestamp
}

/** A question selected into Killing Questions mode, annotated with why it was picked. */
export interface TargetedQuestion {
  question: Question;
  reason: string; // e.g. "You missed 4/6 questions on Quadratic Functions"
}

/** Sync cue for IELTS Listening — question becomes active at this point in the audio. */
export interface ListeningCue {
  atSeconds: number;
  questionId: string;
}

export interface SpeakingPrompt {
  part: 1 | 2 | 3;
  title: string;
  prompt: string;
  prepSeconds: number;
  speakSeconds: number;
}

/** Row in the Admin dashboard's user directory — one student's scores across every exam. */
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO timestamp
  scores: Partial<Record<ExamType, number>>; // readiness score 0-100 per exam type attempted
  overallScore: number; // average readiness score across attempted exams
}

export type SmartStudioStatus = "processing" | "ready" | "failed";

/** One question the Smart Studio pipeline recognized from an uploaded document. */
export interface SmartStudioQuestion {
  id: string;
  prompt: string;
  passage?: string;
  choices: AnswerChoice[];
  correctChoiceId: string;
  explanation: string;
}

/** Per-question grading outcome once a Smart Studio test is submitted. */
export interface SmartStudioAnswerResult {
  questionId: string;
  selectedChoiceId: string | null;
  isCorrect: boolean;
  correctChoiceId: string;
  explanation: string;
}

export interface SmartStudioGradedResult {
  testId: string;
  submittedAt: string; // ISO timestamp
  score: number;
  total: number;
  results: SmartStudioAnswerResult[];
}

/** A user-uploaded test paper (document, photo, or screenshot) processed by Smart Studio. */
export interface SmartStudioTest {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string; // ISO timestamp
  status: SmartStudioStatus;
  detectedTitle: string; // best-guess title recognized from the uploaded paper
  questions: SmartStudioQuestion[];
  lastResult?: SmartStudioGradedResult;
}

export type UploadedExamSourceType = "document" | "url";

/** A past test the user uploaded (or pointed to via URL) that was assembled into a full, timed exam. */
export interface UploadedExam {
  id: string;
  examType: ExamType;
  sourceType: UploadedExamSourceType;
  sourceName: string; // file name, or the URL it was extracted from
  detectedTitle: string;
  uploadedAt: string; // ISO timestamp
  modules: ExamModule[];
  questionsById: Record<string, Question>;
}

// ---------------------------------------------------------------------------
// Let's Play — real-time multiplayer trivia (Supabase Postgres + Realtime backed)
// ---------------------------------------------------------------------------

export type LetsPlayStatus = "lobby" | "active" | "reveal" | "finished";

/** Mirrors a row in public.lets_play_rooms (see supabase/lets_play_schema.sql). */
export interface LetsPlayRoom {
  id: string;
  code: string;
  hostId: string;
  examType: ExamType;
  domain: SkillDomain;
  questions: Question[];
  status: LetsPlayStatus;
  currentQuestionIndex: number;
  currentQuestionId: string | null;
  currentQuestionWinner: string | null;
  currentQuestionStartedAt: string | null; // ISO timestamp
  createdAt: string; // ISO timestamp
}

/** Mirrors a row in public.lets_play_players. */
export interface LetsPlayPlayer {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  avatarInitials: string;
  score: number;
  joinedAt: string; // ISO timestamp
}

/** Mirrors a row in public.lets_play_answers — the live "who answered" feed for the current question. */
export interface LetsPlayAnswer {
  id: string;
  roomId: string;
  questionId: string;
  userId: string;
  choiceId: string;
  isCorrect: boolean;
  points: number;
  answeredAt: string; // ISO timestamp
}
