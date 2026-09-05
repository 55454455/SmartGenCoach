// Rich, realistic mock data standing in for Supabase + the Multi-Agent AI System.
// PHASE2: every export here is replaced by a Supabase query or an agent response —
// the shapes (lib/types.ts) do not change, only where the data comes from.
import type {
  AdminUserRow,
  AgentFeedback,
  ApDomain,
  DsatDomain,
  ExamAttempt,
  ExamModule,
  ExamType,
  IeltsDomain,
  ListeningCue,
  Question,
  ReadinessReport,
  SkillScore,
  SmartStudioQuestion,
  SmartStudioTest,
  SpeakingPrompt,
  UploadedExam,
  UserProfile,
} from "./types";

export const DEMO_USER: UserProfile = {
  id: "user_demo_001",
  name: "Amina Butt",
  email: "amina@example.com",
  avatarInitials: "AB",
  createdAt: "2026-04-02T09:15:00.000Z",
  targetExams: ["DSAT", "AP", "IELTS"],
  targetScores: { DSAT: 1450, AP: 5, IELTS: 80 },
  role: "user",
};

// PHASE2: the admin account becomes a real Supabase user with a `role: "admin"` claim
// enforced by RLS policies, rather than a hardcoded mock email.
export const ADMIN_USER: UserProfile = {
  id: "user_admin_001",
  name: "Site Admin",
  email: "admin@smartgencoach.ai",
  avatarInitials: "SA",
  createdAt: "2026-01-10T09:00:00.000Z",
  targetExams: [],
  targetScores: {},
  role: "admin",
};

// PHASE2: replaced by a Supabase query joining `profiles` with aggregated `readiness_reports`,
// scoped by an admin-only RLS policy.
export const ADMIN_USER_DIRECTORY: AdminUserRow[] = [
  {
    id: DEMO_USER.id,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    createdAt: DEMO_USER.createdAt,
    scores: { DSAT: 83, AP: 80, IELTS: 76 },
    overallScore: 80,
  },
  {
    id: "user_002",
    name: "Marcus Webb",
    email: "marcus.webb@example.com",
    createdAt: "2026-02-14T11:20:00.000Z",
    scores: { DSAT: 91, AP: 88 },
    overallScore: 90,
  },
  {
    id: "user_003",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    createdAt: "2026-03-01T08:45:00.000Z",
    scores: { IELTS: 85 },
    overallScore: 85,
  },
  {
    id: "user_004",
    name: "Diego Fernandez",
    email: "diego.fernandez@example.com",
    createdAt: "2026-03-18T15:30:00.000Z",
    scores: { DSAT: 62, AP: 58 },
    overallScore: 60,
  },
  {
    id: "user_005",
    name: "Hana Kimura",
    email: "hana.kimura@example.com",
    createdAt: "2026-04-05T10:05:00.000Z",
    scores: { DSAT: 74, IELTS: 91 },
    overallScore: 83,
  },
  {
    id: "user_006",
    name: "Tunde Adeyemi",
    email: "tunde.adeyemi@example.com",
    createdAt: "2026-05-02T13:10:00.000Z",
    scores: { AP: 95 },
    overallScore: 95,
  },
  {
    id: "user_007",
    name: "Sofia Marchetti",
    email: "sofia.marchetti@example.com",
    createdAt: "2026-05-20T09:55:00.000Z",
    scores: { DSAT: 55, AP: 61, IELTS: 68 },
    overallScore: 61,
  },
  {
    id: "user_008",
    name: "Owen Baptiste",
    email: "owen.baptiste@example.com",
    createdAt: "2026-06-11T17:40:00.000Z",
    scores: { DSAT: 78 },
    overallScore: 78,
  },
];

// ---------------------------------------------------------------------------
// Skill catalog — the fixed taxonomy of sub-skills per exam/domain.
// ---------------------------------------------------------------------------

interface SkillDef {
  skillId: string;
  skillName: string;
  examType: ExamType;
  domain: DsatDomain | ApDomain | IeltsDomain;
  // DSAT only: which of College Board's 4 official content domains (per section) this skill
  // belongs to. Drives DSAT_CONTENT_DOMAIN_TARGETS below — every other exam type ignores this.
  contentDomain?: string;
}

export const SKILL_CATALOG: SkillDef[] = [
  // DSAT Math — contentDomain matches College Board's 4 official Math content domains.
  { skillId: "dsat-math-linear-eq", skillName: "Linear Equations", examType: "DSAT", domain: "Math", contentDomain: "Algebra" },
  { skillId: "dsat-math-systems", skillName: "Systems of Equations", examType: "DSAT", domain: "Math", contentDomain: "Algebra" },
  { skillId: "dsat-math-quadratics", skillName: "Quadratic Functions", examType: "DSAT", domain: "Math", contentDomain: "Advanced Math" },
  { skillId: "dsat-math-ratios", skillName: "Ratios & Proportions", examType: "DSAT", domain: "Math", contentDomain: "Problem-Solving and Data Analysis" },
  { skillId: "dsat-math-stats", skillName: "Statistics & Probability", examType: "DSAT", domain: "Math", contentDomain: "Problem-Solving and Data Analysis" },
  { skillId: "dsat-math-geometry", skillName: "Geometry & Trigonometry", examType: "DSAT", domain: "Math", contentDomain: "Geometry and Trigonometry" },
  // DSAT Reading and Writing — College Board's 4 official R&W content domains, 1:1 with these skills.
  { skillId: "dsat-rw-craft", skillName: "Craft and Structure", examType: "DSAT", domain: "Reading and Writing", contentDomain: "Craft and Structure" },
  { skillId: "dsat-rw-info", skillName: "Information and Ideas", examType: "DSAT", domain: "Reading and Writing", contentDomain: "Information and Ideas" },
  { skillId: "dsat-rw-conventions", skillName: "Standard English Conventions", examType: "DSAT", domain: "Reading and Writing", contentDomain: "Standard English Conventions" },
  { skillId: "dsat-rw-expression", skillName: "Expression of Ideas", examType: "DSAT", domain: "Reading and Writing", contentDomain: "Expression of Ideas" },
  // AP Calculus
  { skillId: "ap-calc-limits", skillName: "Limits & Continuity", examType: "AP", domain: "Calculus" },
  { skillId: "ap-calc-derivatives", skillName: "Derivatives", examType: "AP", domain: "Calculus" },
  { skillId: "ap-calc-applications", skillName: "Applications of Derivatives", examType: "AP", domain: "Calculus" },
  { skillId: "ap-calc-integrals", skillName: "Integrals", examType: "AP", domain: "Calculus" },
  { skillId: "ap-calc-series", skillName: "Series & Sequences", examType: "AP", domain: "Calculus" },
  // AP History
  { skillId: "ap-hist-colonial", skillName: "Colonial America", examType: "AP", domain: "History" },
  { skillId: "ap-hist-revolution", skillName: "Revolutionary Era", examType: "AP", domain: "History" },
  { skillId: "ap-hist-reconstruction", skillName: "Reconstruction", examType: "AP", domain: "History" },
  { skillId: "ap-hist-industrial", skillName: "Industrialization", examType: "AP", domain: "History" },
  { skillId: "ap-hist-coldwar", skillName: "Cold War", examType: "AP", domain: "History" },
  // IELTS Listening
  { skillId: "ielts-listen-detail", skillName: "Detail & Fact Matching", examType: "IELTS", domain: "Listening" },
  { skillId: "ielts-listen-notes", skillName: "Form & Note Completion", examType: "IELTS", domain: "Listening" },
  { skillId: "ielts-listen-map", skillName: "Map & Diagram Labeling", examType: "IELTS", domain: "Listening" },
  // IELTS Reading
  { skillId: "ielts-read-tfng", skillName: "True/False/Not Given", examType: "IELTS", domain: "Reading" },
  { skillId: "ielts-read-headings", skillName: "Matching Headings", examType: "IELTS", domain: "Reading" },
  { skillId: "ielts-read-skim", skillName: "Skimming & Scanning", examType: "IELTS", domain: "Reading" },
  // IELTS Writing
  { skillId: "ielts-write-task", skillName: "Task Achievement", examType: "IELTS", domain: "Writing" },
  { skillId: "ielts-write-coherence", skillName: "Coherence & Cohesion", examType: "IELTS", domain: "Writing" },
  { skillId: "ielts-write-lexical", skillName: "Lexical Resource", examType: "IELTS", domain: "Writing" },
  { skillId: "ielts-write-grammar", skillName: "Grammatical Range & Accuracy", examType: "IELTS", domain: "Writing" },
  // IELTS Speaking
  { skillId: "ielts-speak-fluency", skillName: "Fluency & Coherence", examType: "IELTS", domain: "Speaking" },
  { skillId: "ielts-speak-lexical", skillName: "Lexical Resource", examType: "IELTS", domain: "Speaking" },
  { skillId: "ielts-speak-grammar", skillName: "Grammatical Range & Accuracy", examType: "IELTS", domain: "Speaking" },
  { skillId: "ielts-speak-pronunciation", skillName: "Pronunciation", examType: "IELTS", domain: "Speaking" },
];

export function getSkillDef(skillId: string): SkillDef {
  const def = SKILL_CATALOG.find((s) => s.skillId === skillId);
  if (!def) throw new Error(`Unknown skillId: ${skillId}`);
  return def;
}

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

export const QUESTION_BANK: Question[] = [
  // ---- DSAT Math — Module 1 ----
  {
    id: "q-dsat-math-001",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-linear-eq",
    skillName: "Linear Equations",
    prompt: "If 3x + 7 = 22, what is the value of x?",
    choices: [
      { id: "a", text: "3" },
      { id: "b", text: "5" },
      { id: "c", text: "7" },
      { id: "d", text: "15" },
    ],
    correctChoiceId: "b",
    difficulty: "Easy",
    explanation: "Subtract 7 from both sides to get 3x = 15, then divide by 3 to get x = 5.",
  },
  {
    id: "q-dsat-math-002",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-systems",
    skillName: "Systems of Equations",
    prompt: "y = 2x + 1 and y = -x + 7. What is the value of x at the solution to this system?",
    choices: [
      { id: "a", text: "1" },
      { id: "b", text: "2" },
      { id: "c", text: "3" },
      { id: "d", text: "4" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "Setting 2x + 1 = -x + 7 gives 3x = 6, so x = 2.",
  },
  {
    id: "q-dsat-math-003",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-quadratics",
    skillName: "Quadratic Functions",
    prompt: "What are the solutions to x^2 - 5x + 6 = 0?",
    choices: [
      { id: "a", text: "x = 1, 6" },
      { id: "b", text: "x = 2, 3" },
      { id: "c", text: "x = -2, -3" },
      { id: "d", text: "x = 2, -3" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "Factoring gives (x - 2)(x - 3) = 0, so x = 2 or x = 3.",
  },
  {
    id: "q-dsat-math-004",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-ratios",
    skillName: "Ratios & Proportions",
    prompt: "A recipe uses 2 cups of flour for every 3 cups of sugar. How many cups of flour are needed for 12 cups of sugar?",
    choices: [
      { id: "a", text: "6" },
      { id: "b", text: "8" },
      { id: "c", text: "9" },
      { id: "d", text: "18" },
    ],
    correctChoiceId: "b",
    difficulty: "Easy",
    explanation: "The ratio 2:3 scaled by 4 (since 12/3 = 4) gives 8 cups of flour.",
  },
  // ---- DSAT Math — Module 2 ----
  {
    id: "q-dsat-math-005",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-stats",
    skillName: "Statistics & Probability",
    prompt: "A bag contains 4 red and 6 blue marbles. What is the probability of drawing a red marble at random?",
    choices: [
      { id: "a", text: "2/5" },
      { id: "b", text: "1/3" },
      { id: "c", text: "3/5" },
      { id: "d", text: "1/2" },
    ],
    correctChoiceId: "a",
    difficulty: "Easy",
    explanation: "There are 4 red marbles out of 10 total, so the probability is 4/10 = 2/5.",
  },
  {
    id: "q-dsat-math-006",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-geometry",
    skillName: "Geometry & Trigonometry",
    prompt: "In a right triangle, the two legs measure 6 and 8. What is the length of the hypotenuse?",
    choices: [
      { id: "a", text: "10" },
      { id: "b", text: "12" },
      { id: "c", text: "14" },
      { id: "d", text: "16" },
    ],
    correctChoiceId: "a",
    difficulty: "Easy",
    explanation: "By the Pythagorean theorem, sqrt(6^2 + 8^2) = sqrt(100) = 10.",
  },
  {
    id: "q-dsat-math-007",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-quadratics",
    skillName: "Quadratic Functions",
    prompt: "The function f(x) = x^2 - 4x + 4 has a minimum value at x = ?",
    choices: [
      { id: "a", text: "-2" },
      { id: "b", text: "0" },
      { id: "c", text: "2" },
      { id: "d", text: "4" },
    ],
    correctChoiceId: "c",
    difficulty: "Medium",
    explanation: "The vertex of f(x) = (x - 2)^2 occurs at x = 2.",
  },
  {
    id: "q-dsat-math-008",
    examType: "DSAT",
    domain: "Math",
    skillId: "dsat-math-linear-eq",
    skillName: "Linear Equations",
    prompt: "A line passes through (0, 3) and (4, 11). What is its slope?",
    choices: [
      { id: "a", text: "1" },
      { id: "b", text: "2" },
      { id: "c", text: "3" },
      { id: "d", text: "4" },
    ],
    correctChoiceId: "b",
    difficulty: "Easy",
    explanation: "Slope = (11 - 3) / (4 - 0) = 8 / 4 = 2.",
  },

  // ---- DSAT Reading and Writing — Module 1 ----
  {
    id: "q-dsat-rw-001",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-craft",
    skillName: "Craft and Structure",
    passage:
      "The lighthouse keeper had watched a thousand storms roll in from the same stretch of gray water, yet each one seemed to arrive as if for the first time, indifferent to the fact that it had a predecessor.",
    prompt: "As used in the passage, the word \"indifferent\" most nearly means",
    choices: [
      { id: "a", text: "hostile" },
      { id: "b", text: "unconcerned" },
      { id: "c", text: "curious" },
      { id: "d", text: "grateful" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "In context, the storm arrives without regard for the past — \"unconcerned\" best captures this.",
  },
  {
    id: "q-dsat-rw-002",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-info",
    skillName: "Information and Ideas",
    passage:
      "Urban beekeeping has grown steadily over the past decade. Advocates argue it supports pollinator populations, while critics note that a high density of honeybee colonies in small areas can outcompete native wild bee species for limited floral resources.",
    prompt: "Which choice best states the main concern raised by critics in the passage?",
    choices: [
      { id: "a", text: "Honeybees produce less honey in urban settings." },
      { id: "b", text: "Urban beekeeping is too costly to maintain." },
      { id: "c", text: "Dense honeybee populations may crowd out native wild bees." },
      { id: "d", text: "Cities lack the regulations needed to support beekeeping." },
    ],
    correctChoiceId: "c",
    difficulty: "Medium",
    explanation: "The passage states critics worry about honeybees outcompeting native wild bee species.",
  },
  {
    id: "q-dsat-rw-003",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-conventions",
    skillName: "Standard English Conventions",
    prompt: "Choose the option that correctly completes the sentence: \"Neither the coach nor the players ___ satisfied with the referee's call.\"",
    choices: [
      { id: "a", text: "was" },
      { id: "b", text: "were" },
      { id: "c", text: "is" },
      { id: "d", text: "has been" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "With \"neither/nor,\" the verb agrees with the closer subject, \"players,\" which is plural.",
  },
  {
    id: "q-dsat-rw-004",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-expression",
    skillName: "Expression of Ideas",
    prompt: "Which choice most effectively combines the two sentences: \"The bridge was closed for repairs. Commuters faced hour-long delays.\"",
    choices: [
      { id: "a", text: "The bridge was closed for repairs, but commuters faced hour-long delays." },
      { id: "b", text: "Because the bridge was closed for repairs, commuters faced hour-long delays." },
      { id: "c", text: "The bridge was closed for repairs, or commuters faced hour-long delays." },
      { id: "d", text: "The bridge was closed for repairs; commuters, faced hour-long delays." },
    ],
    correctChoiceId: "b",
    difficulty: "Easy",
    explanation: "\"Because\" correctly signals the causal relationship between the closure and the delays.",
  },
  // ---- DSAT Reading and Writing — Module 2 ----
  {
    id: "q-dsat-rw-005",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-craft",
    skillName: "Craft and Structure",
    passage:
      "Two historians examined the same trade ledger. One concluded that the port's decline was due to silting of the harbor; the other pointed to shifting tariffs as the decisive factor.",
    prompt: "The relationship between the two historians' conclusions is best described as one of",
    choices: [
      { id: "a", text: "agreement on cause, disagreement on effect" },
      { id: "b", text: "differing explanations for the same outcome" },
      { id: "c", text: "one confirming and one refuting the existence of decline" },
      { id: "d", text: "chronological disagreement about when decline began" },
    ],
    correctChoiceId: "b",
    difficulty: "Hard",
    explanation: "Both agree the port declined but attribute it to different causes — differing explanations for the same outcome.",
  },
  {
    id: "q-dsat-rw-006",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-info",
    skillName: "Information and Ideas",
    passage:
      "A study tracked 200 households that switched to programmable thermostats. Average energy bills fell by 9% in the first year, though the study's authors noted that participants also reported changing thermostat settings manually more often than expected.",
    prompt: "The authors' note about manual setting changes primarily serves to",
    choices: [
      { id: "a", text: "discredit the 9% savings figure entirely" },
      { id: "b", text: "suggest an alternative factor that may have contributed to the savings" },
      { id: "c", text: "prove that programmable thermostats do not work" },
      { id: "d", text: "argue that households should stop using thermostats manually" },
    ],
    correctChoiceId: "b",
    difficulty: "Hard",
    explanation: "The note complicates a simple causal claim by suggesting manual behavior may also explain some of the savings.",
  },
  {
    id: "q-dsat-rw-007",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-conventions",
    skillName: "Standard English Conventions",
    prompt: "Which choice correctly punctuates the sentence: \"The museum's newest exhibit which opens Friday features rare fossils.\"",
    choices: [
      { id: "a", text: "The museum's newest exhibit, which opens Friday, features rare fossils." },
      { id: "b", text: "The museum's newest exhibit; which opens Friday; features rare fossils." },
      { id: "c", text: "The museum's newest exhibit which opens Friday, features rare fossils." },
      { id: "d", text: "The museum's newest exhibit, which opens Friday features rare fossils." },
    ],
    correctChoiceId: "a",
    difficulty: "Medium",
    explanation: "The nonessential clause \"which opens Friday\" must be set off by commas on both sides.",
  },
  {
    id: "q-dsat-rw-008",
    examType: "DSAT",
    domain: "Reading and Writing",
    skillId: "dsat-rw-expression",
    skillName: "Expression of Ideas",
    prompt: "Which transition best fits: \"The trial data was incomplete. ___, the committee delayed its final recommendation.\"",
    choices: [
      { id: "a", text: "Similarly" },
      { id: "b", text: "As a result" },
      { id: "c", text: "For example" },
      { id: "d", text: "In contrast" },
    ],
    correctChoiceId: "b",
    difficulty: "Easy",
    explanation: "\"As a result\" correctly signals that the delay was a consequence of the incomplete data.",
  },

  // ---- AP Calculus ----
  {
    id: "q-ap-calc-001",
    examType: "AP",
    domain: "Calculus",
    skillId: "ap-calc-limits",
    skillName: "Limits & Continuity",
    prompt: "What is the value of lim(x→2) (x^2 - 4)/(x - 2)?",
    choices: [
      { id: "a", text: "0" },
      { id: "b", text: "2" },
      { id: "c", text: "4" },
      { id: "d", text: "Undefined" },
    ],
    correctChoiceId: "c",
    difficulty: "Medium",
    explanation: "Factor to (x-2)(x+2)/(x-2) = x+2, which approaches 4 as x approaches 2.",
  },
  {
    id: "q-ap-calc-002",
    examType: "AP",
    domain: "Calculus",
    skillId: "ap-calc-derivatives",
    skillName: "Derivatives",
    prompt: "What is d/dx of 3x^4 - 2x^2 + 5?",
    choices: [
      { id: "a", text: "12x^3 - 4x" },
      { id: "b", text: "12x^3 - 2x" },
      { id: "c", text: "3x^3 - 4x" },
      { id: "d", text: "9x^3 - 4x" },
    ],
    correctChoiceId: "a",
    difficulty: "Easy",
    explanation: "Applying the power rule term by term gives 12x^3 - 4x.",
  },
  {
    id: "q-ap-calc-003",
    examType: "AP",
    domain: "Calculus",
    skillId: "ap-calc-applications",
    skillName: "Applications of Derivatives",
    prompt: "A particle's position is s(t) = t^3 - 6t^2. At what time t > 0 is the particle's velocity zero (other than t = 0)?",
    choices: [
      { id: "a", text: "t = 2" },
      { id: "b", text: "t = 3" },
      { id: "c", text: "t = 4" },
      { id: "d", text: "t = 6" },
    ],
    correctChoiceId: "c",
    difficulty: "Hard",
    explanation: "v(t) = 3t^2 - 12t = 3t(t - 4), so velocity is zero at t = 0 and t = 4.",
  },
  {
    id: "q-ap-calc-004",
    examType: "AP",
    domain: "Calculus",
    skillId: "ap-calc-integrals",
    skillName: "Integrals",
    prompt: "What is the value of the definite integral of 2x from 0 to 3?",
    choices: [
      { id: "a", text: "6" },
      { id: "b", text: "9" },
      { id: "c", text: "3" },
      { id: "d", text: "12" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "The antiderivative is x^2, evaluated from 0 to 3 gives 9 - 0 = 9.",
  },
  {
    id: "q-ap-calc-005",
    examType: "AP",
    domain: "Calculus",
    skillId: "ap-calc-series",
    skillName: "Series & Sequences",
    prompt: "Does the series sum of (1/2)^n from n=0 to infinity converge, and if so, to what value?",
    choices: [
      { id: "a", text: "Diverges" },
      { id: "b", text: "Converges to 1" },
      { id: "c", text: "Converges to 2" },
      { id: "d", text: "Converges to 1/2" },
    ],
    correctChoiceId: "c",
    difficulty: "Hard",
    explanation: "This is a geometric series with ratio 1/2, converging to a/(1-r) = 1/(1-0.5) = 2.",
  },

  // ---- AP History ----
  {
    id: "q-ap-hist-001",
    examType: "AP",
    domain: "History",
    skillId: "ap-hist-colonial",
    skillName: "Colonial America",
    prompt: "Which colonial region relied most heavily on cash crop plantations worked by enslaved labor?",
    choices: [
      { id: "a", text: "New England" },
      { id: "b", text: "Middle Colonies" },
      { id: "c", text: "Chesapeake and Southern Colonies" },
      { id: "d", text: "Canadian Maritimes" },
    ],
    correctChoiceId: "c",
    difficulty: "Easy",
    explanation: "Tobacco and rice plantation economies were centered in the Chesapeake and Southern colonies.",
  },
  {
    id: "q-ap-hist-002",
    examType: "AP",
    domain: "History",
    skillId: "ap-hist-revolution",
    skillName: "Revolutionary Era",
    prompt: "The Stamp Act of 1765 primarily provoked colonial protest because it",
    choices: [
      { id: "a", text: "banned colonial trade with Britain entirely" },
      { id: "b", text: "taxed printed materials without colonial representation in Parliament" },
      { id: "c", text: "established a standing army in every colony" },
      { id: "d", text: "abolished colonial legislatures" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "The Stamp Act taxed paper goods directly, fueling \"no taxation without representation\" protests.",
  },
  {
    id: "q-ap-hist-003",
    examType: "AP",
    domain: "History",
    skillId: "ap-hist-reconstruction",
    skillName: "Reconstruction",
    prompt: "Which amendment granted formerly enslaved men the right to vote?",
    choices: [
      { id: "a", text: "13th Amendment" },
      { id: "b", text: "14th Amendment" },
      { id: "c", text: "15th Amendment" },
      { id: "d", text: "19th Amendment" },
    ],
    correctChoiceId: "c",
    difficulty: "Easy",
    explanation: "The 15th Amendment (1870) prohibited denying voting rights based on race.",
  },
  {
    id: "q-ap-hist-004",
    examType: "AP",
    domain: "History",
    skillId: "ap-hist-industrial",
    skillName: "Industrialization",
    prompt: "The rise of vertical integration in the late 19th century is best exemplified by",
    choices: [
      { id: "a", text: "Andrew Carnegie's control of every stage of steel production" },
      { id: "b", text: "the Homestead Act's distribution of farmland" },
      { id: "c", text: "the founding of the Populist Party" },
      { id: "d", text: "the passage of the Sherman Antitrust Act" },
    ],
    correctChoiceId: "a",
    difficulty: "Medium",
    explanation: "Carnegie's steel empire controlled raw materials, transport, and production — the hallmark of vertical integration.",
  },
  {
    id: "q-ap-hist-005",
    examType: "AP",
    domain: "History",
    skillId: "ap-hist-coldwar",
    skillName: "Cold War",
    prompt: "The policy of containment, first articulated by George Kennan, primarily aimed to",
    choices: [
      { id: "a", text: "eliminate all communist governments through direct invasion" },
      { id: "b", text: "prevent the spread of Soviet influence without direct war" },
      { id: "c", text: "merge the US and Soviet economies" },
      { id: "d", text: "withdraw the US from international affairs" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "Containment sought to limit Soviet expansion through diplomatic, economic, and military means short of direct war.",
  },

  // ---- IELTS Reading ----
  {
    id: "q-ielts-read-001",
    examType: "IELTS",
    domain: "Reading",
    skillId: "ielts-read-tfng",
    skillName: "True/False/Not Given",
    passage:
      "The city's tram network, first opened in 1887, was the first in the region to run on electricity rather than horse power. By 1920 it carried over 40 million passengers annually, though ridership declined sharply after 1950 as private car ownership increased.",
    prompt: "\"The tram network's ridership continued to grow after 1950.\" Is this True, False, or Not Given?",
    choices: [
      { id: "a", text: "True" },
      { id: "b", text: "False" },
      { id: "c", text: "Not Given" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "The passage states ridership declined sharply after 1950, contradicting the statement.",
  },
  {
    id: "q-ielts-read-002",
    examType: "IELTS",
    domain: "Reading",
    skillId: "ielts-read-headings",
    skillName: "Matching Headings",
    passage:
      "Paragraph A discusses how coral reefs form over thousands of years through the accumulation of calcium carbonate skeletons left by generations of polyps.",
    prompt: "Which heading best matches Paragraph A?",
    choices: [
      { id: "a", text: "The economic value of reef tourism" },
      { id: "b", text: "How reefs are built over time" },
      { id: "c", text: "Threats facing marine ecosystems" },
      { id: "d", text: "Methods for coral reef conservation" },
    ],
    correctChoiceId: "b",
    difficulty: "Easy",
    explanation: "The paragraph explains the slow formation process of reefs, matching \"How reefs are built over time.\"",
  },
  {
    id: "q-ielts-read-003",
    examType: "IELTS",
    domain: "Reading",
    skillId: "ielts-read-skim",
    skillName: "Skimming & Scanning",
    passage:
      "Researchers surveyed 1,200 remote workers across 14 countries. Notably, only the section on page 6 addresses commute-time savings; the bulk of the report focuses on productivity and reported wellbeing.",
    prompt: "Where should a reader scan to find data on commute-time savings?",
    choices: [
      { id: "a", text: "The introduction" },
      { id: "b", text: "Page 6" },
      { id: "c", text: "The conclusion" },
      { id: "d", text: "The appendix" },
    ],
    correctChoiceId: "b",
    difficulty: "Easy",
    explanation: "The passage explicitly directs commute-time data to page 6.",
  },

  // ---- IELTS Listening (with timestamp cues used by the audio-sync UI) ----
  {
    id: "q-ielts-listen-001",
    examType: "IELTS",
    domain: "Listening",
    skillId: "ielts-listen-detail",
    skillName: "Detail & Fact Matching",
    prompt: "According to the recording, what time does the library close on weekdays?",
    choices: [
      { id: "a", text: "6:00 PM" },
      { id: "b", text: "8:00 PM" },
      { id: "c", text: "9:00 PM" },
      { id: "d", text: "10:00 PM" },
    ],
    correctChoiceId: "c",
    difficulty: "Easy",
    explanation: "The speaker states the library closes at 9:00 PM Monday through Friday.",
  },
  {
    id: "q-ielts-listen-002",
    examType: "IELTS",
    domain: "Listening",
    skillId: "ielts-listen-notes",
    skillName: "Form & Note Completion",
    prompt: "Complete the note: The workshop fee includes materials and a ___.",
    choices: [
      { id: "a", text: "Certificate" },
      { id: "b", text: "Free meal" },
      { id: "c", text: "Textbook" },
      { id: "d", text: "T-shirt" },
    ],
    correctChoiceId: "a",
    difficulty: "Medium",
    explanation: "The speaker confirms the fee covers \"materials and a certificate of completion.\"",
  },
  {
    id: "q-ielts-listen-003",
    examType: "IELTS",
    domain: "Listening",
    skillId: "ielts-listen-map",
    skillName: "Map & Diagram Labeling",
    prompt: "Where is the new information desk located, according to the recording?",
    choices: [
      { id: "a", text: "Next to the main entrance" },
      { id: "b", text: "Beside the elevators on the 2nd floor" },
      { id: "c", text: "Opposite the cafeteria" },
      { id: "d", text: "In the east wing lobby" },
    ],
    correctChoiceId: "b",
    difficulty: "Medium",
    explanation: "The speaker directs listeners to the desk \"beside the elevators, second floor.\"",
  },
];

export const QUESTION_BY_ID = new Map(QUESTION_BANK.map((q) => [q.id, q]));

// ---------------------------------------------------------------------------
// DSAT exam modules — mirrors Bluebook's real module durations. The questionIds arrays below are
// illustrative placeholders only (into the static QUESTION_BANK) — the real per-attempt question
// count and content-domain mix come from DSAT_CONTENT_DOMAIN_TARGETS, not from these arrays'
// length, since a real attempt always generates fresh questions rather than using this bank.
// ---------------------------------------------------------------------------

// Real Bluebook per-module question counts (27 for Reading and Writing, 22 for Math — identical
// in Module 1 and Module 2 of a section) broken down by College Board's official content domains.
// College Board's Digital SAT Assessment Framework publishes these as section-wide *ranges*, not
// fixed per-module integers (Craft and Structure 13–15, Information and Ideas 12–14, Standard
// English Conventions 11–15, Expression of Ideas 8–12 of the 54 R&W questions; Algebra 13–15,
// Advanced Math 13–15, Problem-Solving and Data Analysis 5–7, Geometry and Trigonometry 5–7 of the
// 44 Math questions) so forms can vary module-to-module — there is no single official fixed
// breakdown to match exactly. The counts below are chosen to (a) sum to exactly the real per-module
// total and (b) land close to the midpoint of each official range.
export const DSAT_CONTENT_DOMAIN_TARGETS: Record<DsatDomain, { contentDomain: string; count: number }[]> = {
  "Reading and Writing": [
    { contentDomain: "Craft and Structure", count: 8 },
    { contentDomain: "Information and Ideas", count: 7 },
    { contentDomain: "Standard English Conventions", count: 7 },
    { contentDomain: "Expression of Ideas", count: 5 },
  ],
  Math: [
    { contentDomain: "Algebra", count: 8 },
    { contentDomain: "Advanced Math", count: 8 },
    { contentDomain: "Problem-Solving and Data Analysis", count: 3 },
    { contentDomain: "Geometry and Trigonometry", count: 3 },
  ],
};

export const DSAT_MODULES: ExamModule[] = [
  {
    id: "dsat-rw-module-1",
    title: "Section 1, Module 1: Reading and Writing",
    domain: "Reading and Writing",
    durationSeconds: 32 * 60,
    questionIds: ["q-dsat-rw-001", "q-dsat-rw-002", "q-dsat-rw-003", "q-dsat-rw-004"],
  },
  {
    id: "dsat-rw-module-2",
    title: "Section 1, Module 2: Reading and Writing",
    domain: "Reading and Writing",
    durationSeconds: 32 * 60,
    questionIds: ["q-dsat-rw-005", "q-dsat-rw-006", "q-dsat-rw-007", "q-dsat-rw-008"],
  },
  {
    id: "dsat-math-module-1",
    title: "Section 2, Module 1: Math",
    domain: "Math",
    durationSeconds: 35 * 60,
    questionIds: ["q-dsat-math-001", "q-dsat-math-002", "q-dsat-math-003", "q-dsat-math-004"],
  },
  {
    id: "dsat-math-module-2",
    title: "Section 2, Module 2: Math",
    domain: "Math",
    durationSeconds: 35 * 60,
    questionIds: ["q-dsat-math-005", "q-dsat-math-006", "q-dsat-math-007", "q-dsat-math-008"],
  },
];

// ---------------------------------------------------------------------------
// AP exam modules — one timed module per subject test.
// ---------------------------------------------------------------------------

export const AP_MODULES: ExamModule[] = [
  {
    id: "ap-calculus-module-1",
    title: "AP Calculus: Multiple Choice",
    domain: "Calculus",
    durationSeconds: 40 * 60,
    questionIds: ["q-ap-calc-001", "q-ap-calc-002", "q-ap-calc-003", "q-ap-calc-004", "q-ap-calc-005"],
  },
  {
    id: "ap-history-module-1",
    title: "AP US History: Multiple Choice",
    domain: "History",
    durationSeconds: 35 * 60,
    questionIds: ["q-ap-hist-001", "q-ap-hist-002", "q-ap-hist-003", "q-ap-hist-004", "q-ap-hist-005"],
  },
];

// ---------------------------------------------------------------------------
// IELTS Listening cues + Speaking prompts
// ---------------------------------------------------------------------------

// Calibrated to roughly match how long the Web Speech API takes to speak IELTS_LISTENING_TRANSCRIPT
// aloud at a typical browser TTS rate (~2.5-3 words/sec) — see the transcript below.
export const IELTS_LISTENING_AUDIO_DURATION_SECONDS = 60;

export const IELTS_LISTENING_CUES: ListeningCue[] = [
  { atSeconds: 12, questionId: "q-ielts-listen-001" },
  { atSeconds: 28, questionId: "q-ielts-listen-002" },
  { atSeconds: 42, questionId: "q-ielts-listen-003" },
];

// PHASE2: swap this scripted announcement for a real generated/streamed audio asset produced by
// the English/Speaking Agent. Spoken aloud via the Web Speech API so playback is genuinely real
// audio (not a simulated timer) even though no pre-recorded asset exists in this mock backend.
export const IELTS_LISTENING_TRANSCRIPT = `Good morning, and welcome to the Riverside Community Center. Before today's activities begin, please take note of a few announcements.
First, a reminder about our operating hours. The library on the ground floor closes at nine PM on weekdays, but please note that on weekends it closes earlier, at six PM, so plan your visits accordingly.
Next, for anyone interested in this Saturday's pottery workshop, spaces are still available. The workshop fee covers all clay and glazing materials, and every participant will also receive a certificate of completion at the end of the session. Sign-up sheets are available at reception.
Finally, please note that our information desk has moved. It is no longer near the main entrance. The new information desk is now located beside the elevators on the second floor, so please head upstairs if you need directions or assistance.
Thank you for listening, and we hope you enjoy your time at the center today.`;

export const IELTS_SPEAKING_PROMPTS: SpeakingPrompt[] = [
  {
    part: 1,
    title: "Part 1 — Introduction & Interview",
    prompt: "Let's talk about your hometown. What do you like most about the place where you grew up?",
    prepSeconds: 0,
    speakSeconds: 30,
  },
  {
    part: 2,
    title: "Part 2 — Long Turn",
    prompt:
      "Describe a skill you learned recently. You should say: what the skill is, how you learned it, how long it took, and explain why you decided to learn it.",
    prepSeconds: 60,
    speakSeconds: 120,
  },
  {
    part: 3,
    title: "Part 3 — Two-Way Discussion",
    prompt: "Do you think it's more important today to learn practical skills or academic knowledge? Why?",
    prepSeconds: 15,
    speakSeconds: 60,
  },
];

// ---------------------------------------------------------------------------
// Historical exam attempts — 3 per exam type, oldest to newest, showing growth.
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date("2026-07-24T12:00:00.000Z");
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function skillScore(
  skillId: string,
  correct: number,
  attempted: number,
  lastPracticedDaysAgo: number,
  trend: SkillScore["trend"],
): SkillScore {
  const def = getSkillDef(skillId);
  return {
    skillId,
    skillName: def.skillName,
    domain: def.domain,
    examType: def.examType,
    correct,
    attempted,
    errorRate: Number((1 - correct / attempted).toFixed(2)),
    lastPracticed: daysAgo(lastPracticedDaysAgo),
    trend,
  };
}

function feedback(id: string, agentName: string, summary: string, strengths: string[], weaknesses: string[], daysBack: number): AgentFeedback {
  return { id, agentName, summary, strengths, weaknesses, generatedAt: daysAgo(daysBack) };
}

export const EXAM_ATTEMPTS: ExamAttempt[] = [
  // ----- DSAT: 3 full-length attempts -----
  {
    id: "attempt-dsat-1",
    userId: DEMO_USER.id,
    examType: "DSAT",
    mode: "Full Exam",
    dateTaken: daysAgo(58),
    durationMinutes: 134,
    scaledScore: 1050,
    maxScore: 1600,
    rawCorrect: 61,
    rawTotal: 98,
    skillScores: [
      skillScore("dsat-math-linear-eq", 6, 8, 58, "flat"),
      skillScore("dsat-math-systems", 4, 8, 58, "flat"),
      skillScore("dsat-math-quadratics", 3, 8, 58, "flat"),
      skillScore("dsat-math-ratios", 5, 7, 58, "flat"),
      skillScore("dsat-math-stats", 4, 7, 58, "flat"),
      skillScore("dsat-math-geometry", 3, 6, 58, "flat"),
      skillScore("dsat-rw-craft", 7, 10, 58, "flat"),
      skillScore("dsat-rw-info", 6, 10, 58, "flat"),
      skillScore("dsat-rw-conventions", 5, 9, 58, "flat"),
      skillScore("dsat-rw-expression", 6, 9, 58, "flat"),
    ],
    agentFeedback: feedback(
      "fb-dsat-1",
      "Orchestrator",
      "Solid baseline. Quadratic Functions and Geometry & Trigonometry are the biggest drags on your Math score.",
      ["Linear Equations", "Craft and Structure"],
      ["Quadratic Functions", "Geometry & Trigonometry", "Standard English Conventions"],
      58,
    ),
  },
  {
    id: "attempt-dsat-2",
    userId: DEMO_USER.id,
    examType: "DSAT",
    mode: "Full Exam",
    dateTaken: daysAgo(31),
    durationMinutes: 131,
    scaledScore: 1150,
    maxScore: 1600,
    rawCorrect: 70,
    rawTotal: 98,
    skillScores: [
      skillScore("dsat-math-linear-eq", 7, 8, 31, "up"),
      skillScore("dsat-math-systems", 5, 8, 31, "up"),
      skillScore("dsat-math-quadratics", 4, 8, 31, "up"),
      skillScore("dsat-math-ratios", 6, 7, 31, "up"),
      skillScore("dsat-math-stats", 5, 7, 31, "up"),
      skillScore("dsat-math-geometry", 4, 6, 31, "up"),
      skillScore("dsat-rw-craft", 8, 10, 31, "up"),
      skillScore("dsat-rw-info", 7, 10, 31, "up"),
      skillScore("dsat-rw-conventions", 6, 9, 31, "up"),
      skillScore("dsat-rw-expression", 7, 9, 31, "up"),
    ],
    agentFeedback: feedback(
      "fb-dsat-2",
      "Orchestrator",
      "Nice jump of 100 points. Quadratic Functions is still your weakest sub-skill — worth targeted drills.",
      ["Ratios & Proportions", "Craft and Structure"],
      ["Quadratic Functions", "Statistics & Probability"],
      31,
    ),
  },
  {
    id: "attempt-dsat-3",
    userId: DEMO_USER.id,
    examType: "DSAT",
    mode: "Full Exam",
    dateTaken: daysAgo(6),
    durationMinutes: 129,
    scaledScore: 1240,
    maxScore: 1600,
    rawCorrect: 77,
    rawTotal: 98,
    skillScores: [
      skillScore("dsat-math-linear-eq", 8, 8, 6, "up"),
      skillScore("dsat-math-systems", 6, 8, 6, "up"),
      skillScore("dsat-math-quadratics", 4, 8, 6, "flat"),
      skillScore("dsat-math-ratios", 7, 7, 6, "up"),
      skillScore("dsat-math-stats", 6, 7, 6, "up"),
      skillScore("dsat-math-geometry", 5, 6, 6, "up"),
      skillScore("dsat-rw-craft", 9, 10, 6, "up"),
      skillScore("dsat-rw-info", 8, 10, 6, "up"),
      skillScore("dsat-rw-conventions", 7, 9, 6, "up"),
      skillScore("dsat-rw-expression", 8, 9, 6, "up"),
    ],
    agentFeedback: feedback(
      "fb-dsat-3",
      "Orchestrator",
      "Your strongest attempt yet at 1240. Quadratic Functions has plateaued at 50% — this is now your #1 priority skill.",
      ["Linear Equations (perfect run)", "Ratios & Proportions", "Craft and Structure"],
      ["Quadratic Functions"],
      6,
    ),
  },

  // ----- AP: 3 attempts (Calculus + History combined practice exams) -----
  {
    id: "attempt-ap-1",
    userId: DEMO_USER.id,
    examType: "AP",
    mode: "Full Exam",
    dateTaken: daysAgo(50),
    durationMinutes: 165,
    scaledScore: 2,
    maxScore: 5,
    rawCorrect: 32,
    rawTotal: 60,
    skillScores: [
      skillScore("ap-calc-limits", 3, 6, 50, "flat"),
      skillScore("ap-calc-derivatives", 4, 6, 50, "flat"),
      skillScore("ap-calc-applications", 2, 6, 50, "flat"),
      skillScore("ap-calc-integrals", 2, 6, 50, "flat"),
      skillScore("ap-calc-series", 1, 6, 50, "flat"),
      skillScore("ap-hist-colonial", 4, 6, 50, "flat"),
      skillScore("ap-hist-revolution", 4, 6, 50, "flat"),
      skillScore("ap-hist-reconstruction", 3, 6, 50, "flat"),
      skillScore("ap-hist-industrial", 5, 6, 50, "flat"),
      skillScore("ap-hist-coldwar", 4, 6, 50, "flat"),
    ],
    agentFeedback: feedback(
      "fb-ap-1",
      "Orchestrator",
      "Series & Sequences and Applications of Derivatives need the most attention before your next practice test.",
      ["Industrialization", "Derivatives"],
      ["Series & Sequences", "Applications of Derivatives", "Integrals"],
      50,
    ),
  },
  {
    id: "attempt-ap-2",
    userId: DEMO_USER.id,
    examType: "AP",
    mode: "Full Exam",
    dateTaken: daysAgo(24),
    durationMinutes: 160,
    scaledScore: 3,
    maxScore: 5,
    rawCorrect: 42,
    rawTotal: 60,
    skillScores: [
      skillScore("ap-calc-limits", 4, 6, 24, "up"),
      skillScore("ap-calc-derivatives", 5, 6, 24, "up"),
      skillScore("ap-calc-applications", 3, 6, 24, "up"),
      skillScore("ap-calc-integrals", 3, 6, 24, "up"),
      skillScore("ap-calc-series", 2, 6, 24, "up"),
      skillScore("ap-hist-colonial", 5, 6, 24, "up"),
      skillScore("ap-hist-revolution", 5, 6, 24, "up"),
      skillScore("ap-hist-reconstruction", 4, 6, 24, "up"),
      skillScore("ap-hist-industrial", 5, 6, 24, "flat"),
      skillScore("ap-hist-coldwar", 5, 6, 24, "up"),
    ],
    agentFeedback: feedback(
      "fb-ap-2",
      "Orchestrator",
      "Up to a projected 3. Series & Sequences remains your lowest-scoring skill across both subjects.",
      ["Revolutionary Era", "Derivatives"],
      ["Series & Sequences", "Applications of Derivatives"],
      24,
    ),
  },
  {
    id: "attempt-ap-3",
    userId: DEMO_USER.id,
    examType: "AP",
    mode: "Full Exam",
    dateTaken: daysAgo(3),
    durationMinutes: 158,
    scaledScore: 3,
    maxScore: 5,
    rawCorrect: 47,
    rawTotal: 60,
    skillScores: [
      skillScore("ap-calc-limits", 5, 6, 3, "up"),
      skillScore("ap-calc-derivatives", 6, 6, 3, "up"),
      skillScore("ap-calc-applications", 4, 6, 3, "up"),
      skillScore("ap-calc-integrals", 4, 6, 3, "up"),
      skillScore("ap-calc-series", 2, 6, 3, "flat"),
      skillScore("ap-hist-colonial", 5, 6, 3, "flat"),
      skillScore("ap-hist-revolution", 6, 6, 3, "up"),
      skillScore("ap-hist-reconstruction", 5, 6, 3, "up"),
      skillScore("ap-hist-industrial", 6, 6, 3, "up"),
      skillScore("ap-hist-coldwar", 5, 6, 3, "flat"),
    ],
    agentFeedback: feedback(
      "fb-ap-3",
      "Orchestrator",
      "Derivatives is now a mastered skill. Series & Sequences has not improved in 3 attempts and needs a dedicated study block.",
      ["Derivatives (perfect run)", "Revolutionary Era (perfect run)", "Industrialization (perfect run)"],
      ["Series & Sequences"],
      3,
    ),
  },

  // ----- IELTS: 3 attempts -----
  {
    id: "attempt-ielts-1",
    userId: DEMO_USER.id,
    examType: "IELTS",
    mode: "Full Exam",
    dateTaken: daysAgo(45),
    durationMinutes: 165,
    scaledScore: 60,
    maxScore: 90,
    rawCorrect: 58,
    rawTotal: 90,
    skillScores: [
      skillScore("ielts-listen-detail", 5, 8, 45, "flat"),
      skillScore("ielts-listen-notes", 4, 8, 45, "flat"),
      skillScore("ielts-listen-map", 3, 7, 45, "flat"),
      skillScore("ielts-read-tfng", 5, 8, 45, "flat"),
      skillScore("ielts-read-headings", 4, 7, 45, "flat"),
      skillScore("ielts-read-skim", 5, 8, 45, "flat"),
      skillScore("ielts-write-task", 5, 9, 45, "flat"),
      skillScore("ielts-write-coherence", 4, 9, 45, "flat"),
      skillScore("ielts-write-lexical", 4, 8, 45, "flat"),
      skillScore("ielts-write-grammar", 5, 9, 45, "flat"),
      skillScore("ielts-speak-fluency", 5, 9, 45, "flat"),
      skillScore("ielts-speak-lexical", 4, 8, 45, "flat"),
      skillScore("ielts-speak-grammar", 4, 8, 45, "flat"),
      skillScore("ielts-speak-pronunciation", 5, 9, 45, "flat"),
    ],
    agentFeedback: feedback(
      "fb-ielts-1",
      "Orchestrator",
      "Overall band 6.0. Map & Diagram Labeling in Listening and Lexical Resource in Writing are your weakest areas.",
      ["Detail & Fact Matching", "Pronunciation"],
      ["Map & Diagram Labeling", "Lexical Resource (Writing)", "Coherence & Cohesion"],
      45,
    ),
  },
  {
    id: "attempt-ielts-2",
    userId: DEMO_USER.id,
    examType: "IELTS",
    mode: "Full Exam",
    dateTaken: daysAgo(20),
    durationMinutes: 162,
    scaledScore: 65,
    maxScore: 90,
    rawCorrect: 65,
    rawTotal: 90,
    skillScores: [
      skillScore("ielts-listen-detail", 6, 8, 20, "up"),
      skillScore("ielts-listen-notes", 5, 8, 20, "up"),
      skillScore("ielts-listen-map", 4, 7, 20, "up"),
      skillScore("ielts-read-tfng", 6, 8, 20, "up"),
      skillScore("ielts-read-headings", 5, 7, 20, "up"),
      skillScore("ielts-read-skim", 6, 8, 20, "up"),
      skillScore("ielts-write-task", 6, 9, 20, "up"),
      skillScore("ielts-write-coherence", 5, 9, 20, "up"),
      skillScore("ielts-write-lexical", 5, 8, 20, "up"),
      skillScore("ielts-write-grammar", 6, 9, 20, "up"),
      skillScore("ielts-speak-fluency", 6, 9, 20, "up"),
      skillScore("ielts-speak-lexical", 5, 8, 20, "up"),
      skillScore("ielts-speak-grammar", 5, 8, 20, "up"),
      skillScore("ielts-speak-pronunciation", 6, 9, 20, "up"),
    ],
    agentFeedback: feedback(
      "fb-ielts-2",
      "Speaking Evaluator",
      "Band 6.5 overall. Speaking fluency has improved noticeably; Map & Diagram Labeling is still lagging.",
      ["Fluency & Coherence", "Standard English Conventions carry-over from DSAT prep"],
      ["Map & Diagram Labeling", "Lexical Resource (Writing)"],
      20,
    ),
  },
  {
    id: "attempt-ielts-3",
    userId: DEMO_USER.id,
    examType: "IELTS",
    mode: "Full Exam",
    dateTaken: daysAgo(2),
    durationMinutes: 160,
    scaledScore: 70,
    maxScore: 90,
    rawCorrect: 70,
    rawTotal: 90,
    skillScores: [
      skillScore("ielts-listen-detail", 7, 8, 2, "up"),
      skillScore("ielts-listen-notes", 6, 8, 2, "up"),
      skillScore("ielts-listen-map", 4, 7, 2, "flat"),
      skillScore("ielts-read-tfng", 7, 8, 2, "up"),
      skillScore("ielts-read-headings", 6, 7, 2, "up"),
      skillScore("ielts-read-skim", 7, 8, 2, "up"),
      skillScore("ielts-write-task", 7, 9, 2, "up"),
      skillScore("ielts-write-coherence", 6, 9, 2, "up"),
      skillScore("ielts-write-lexical", 5, 8, 2, "flat"),
      skillScore("ielts-write-grammar", 7, 9, 2, "up"),
      skillScore("ielts-speak-fluency", 7, 9, 2, "up"),
      skillScore("ielts-speak-lexical", 6, 8, 2, "up"),
      skillScore("ielts-speak-grammar", 6, 8, 2, "up"),
      skillScore("ielts-speak-pronunciation", 7, 9, 2, "up"),
    ],
    agentFeedback: feedback(
      "fb-ielts-3",
      "Orchestrator",
      "Band 7.0 — on track for your 8.0 target. Map & Diagram Labeling has stalled for 3 attempts in a row.",
      ["Detail & Fact Matching", "Standard English Conventions", "Task Achievement"],
      ["Map & Diagram Labeling", "Lexical Resource (Writing)"],
      2,
    ),
  },
];

// ---------------------------------------------------------------------------
// Readiness thresholds — used to gate "Killing Questions" mode.
// ---------------------------------------------------------------------------

export const READINESS_THRESHOLDS: Record<ExamType, number> = {
  DSAT: 85,
  AP: 75,
  IELTS: 80,
};

// ---------------------------------------------------------------------------
// Smart Studio — upload any test paper, doc, or screenshot for AI recognition + grading.
// PHASE2: this pool stands in for a vision/OCR extraction pipeline that reads the actual
// uploaded file. Real extraction would produce paper-specific questions instead of drawing
// from a fixed bank, and would generate the answer key + explanations directly from the source.
// ---------------------------------------------------------------------------

export const SMART_STUDIO_QUESTION_POOL: Omit<SmartStudioQuestion, "id">[] = [
  {
    prompt: "Which choice best states the main idea of the passage?",
    passage:
      "Urban beekeeping has grown quickly in the last decade, with hobbyists installing hives on rooftops and in community gardens. Proponents argue that city bees produce comparable honey yields to rural colonies while pollinating a wider variety of ornamental and food plants.",
    choices: [
      { id: "a", text: "City beekeeping is illegal in most municipalities." },
      { id: "b", text: "Urban beekeeping has expanded and may offer pollination benefits comparable to rural hives." },
      { id: "c", text: "Rural honey is of higher quality than urban honey." },
      { id: "d", text: "Community gardens are declining in popularity." },
    ],
    correctChoiceId: "b",
    explanation:
      "The passage's central claim is that urban beekeeping has grown and can match rural yields while pollinating diverse plants — choice B restates this directly; the others contradict or aren't supported by the text.",
  },
  {
    prompt: "If 5x - 3 = 2x + 12, what is the value of x?",
    choices: [
      { id: "a", text: "3" },
      { id: "b", text: "5" },
      { id: "c", text: "9" },
      { id: "d", text: "15" },
    ],
    correctChoiceId: "b",
    explanation: "Subtract 2x from both sides: 3x - 3 = 12. Add 3: 3x = 15. Divide by 3: x = 5.",
  },
  {
    prompt: "Which word most nearly means \"ephemeral\" as it is commonly used?",
    choices: [
      { id: "a", text: "Everlasting" },
      { id: "b", text: "Short-lived" },
      { id: "c", text: "Massive" },
      { id: "d", text: "Transparent" },
    ],
    correctChoiceId: "b",
    explanation: "\"Ephemeral\" describes something that lasts for a very short time, making \"short-lived\" the closest synonym.",
  },
  {
    prompt: "A car travels 240 miles using 8 gallons of gas. At this rate, how many miles can it travel on 5 gallons?",
    choices: [
      { id: "a", text: "120" },
      { id: "b", text: "150" },
      { id: "c", text: "160" },
      { id: "d", text: "180" },
    ],
    correctChoiceId: "b",
    explanation: "The car gets 240 / 8 = 30 miles per gallon. At 30 mpg, 5 gallons covers 30 x 5 = 150 miles.",
  },
  {
    prompt: "Which sentence uses correct subject-verb agreement?",
    choices: [
      { id: "a", text: "The list of items are on the table." },
      { id: "b", text: "The list of items is on the table." },
      { id: "c", text: "The list of items were on the table." },
      { id: "d", text: "The list of items be on the table." },
    ],
    correctChoiceId: "b",
    explanation: "The subject is \"list\" (singular), not \"items,\" so it takes the singular verb \"is.\"",
  },
  {
    prompt: "During photosynthesis, plants primarily convert light energy into which form of chemical energy?",
    choices: [
      { id: "a", text: "ATP and glucose" },
      { id: "b", text: "Carbon dioxide" },
      { id: "c", text: "Nitrogen compounds" },
      { id: "d", text: "Water vapor" },
    ],
    correctChoiceId: "a",
    explanation: "Photosynthesis captures light energy and stores it in the chemical bonds of ATP and glucose, which the plant then uses for growth and metabolism.",
  },
  {
    prompt: "What was a primary cause of the Bronze Age Collapse cited by historians?",
    passage:
      "Around 1200 BCE, several interconnected Mediterranean civilizations declined within a few generations. Historians point to a combination of factors: prolonged drought, crop failures, mass migrations of the so-called 'Sea Peoples,' and the breakdown of long-distance trade networks that had supplied tin and copper for bronze production.",
    choices: [
      { id: "a", text: "A single volcanic eruption destroyed all major cities at once." },
      { id: "b", text: "A combination of drought, migration, and collapsed trade networks weakened the civilizations." },
      { id: "c", text: "The civilizations voluntarily merged into one empire." },
      { id: "d", text: "Bronze was replaced overnight by plastic tools." },
    ],
    correctChoiceId: "b",
    explanation: "The passage lists multiple compounding causes — drought, migration, and broken trade networks — matching choice B; the other options aren't supported by the text.",
  },
  {
    prompt: "Simplify: (3x^2)(4x^3)",
    choices: [
      { id: "a", text: "7x^5" },
      { id: "b", text: "12x^5" },
      { id: "c", text: "12x^6" },
      { id: "d", text: "7x^6" },
    ],
    correctChoiceId: "b",
    explanation: "Multiply coefficients (3 x 4 = 12) and add exponents (x^2 * x^3 = x^5), giving 12x^5.",
  },
  {
    prompt: "Which choice best describes the author's tone in a passage that repeatedly uses words like \"regrettably,\" \"squandered,\" and \"missed opportunity\"?",
    choices: [
      { id: "a", text: "Celebratory" },
      { id: "b", text: "Indifferent" },
      { id: "c", text: "Critical" },
      { id: "d", text: "Amused" },
    ],
    correctChoiceId: "c",
    explanation: "Words like \"regrettably,\" \"squandered,\" and \"missed opportunity\" signal disapproval, so the tone is best described as critical.",
  },
  {
    prompt: "A right triangle has legs of length 6 and 8. What is the length of the hypotenuse?",
    choices: [
      { id: "a", text: "9" },
      { id: "b", text: "10" },
      { id: "c", text: "12" },
      { id: "d", text: "14" },
    ],
    correctChoiceId: "b",
    explanation: "By the Pythagorean theorem, hypotenuse = sqrt(6^2 + 8^2) = sqrt(36 + 64) = sqrt(100) = 10.",
  },
  {
    prompt: "Which choice most logically completes the sentence: \"Despite the storm warnings, the crew ______ to finish loading the ship before dawn.\"",
    choices: [
      { id: "a", text: "refused" },
      { id: "b", text: "hesitated" },
      { id: "c", text: "persisted" },
      { id: "d", text: "forgot" },
    ],
    correctChoiceId: "c",
    explanation: "\"Despite\" signals a contrast with difficulty, so the crew continuing to work anyway is best captured by \"persisted.\"",
  },
  {
    prompt: "If a population of bacteria doubles every 3 hours and starts at 200, how many bacteria are there after 9 hours?",
    choices: [
      { id: "a", text: "800" },
      { id: "b", text: "1,200" },
      { id: "c", text: "1,600" },
      { id: "d", text: "2,400" },
    ],
    correctChoiceId: "c",
    explanation: "9 hours is 3 doubling periods: 200 -> 400 -> 800 -> 1,600.",
  },
];

export function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function humanizeFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
  const spaced = withoutExtension.replace(/[_-]+/g, " ").trim();
  return spaced.length > 0 ? spaced : "Uploaded Test";
}

/** Deterministically "recognizes" a plausible question set from an uploaded file's name/size. */
export function recognizeQuestionsForUpload(fileName: string, fileSizeBytes: number): SmartStudioQuestion[] {
  const seed = hashSeed(fileName + fileSizeBytes);
  const poolSize = SMART_STUDIO_QUESTION_POOL.length;
  const count = 4 + (seed % 3); // 4-6 questions
  const start = seed % poolSize;
  return Array.from({ length: count }, (_, i) => {
    const template = SMART_STUDIO_QUESTION_POOL[(start + i) % poolSize]!;
    return { ...template, id: `sst-q-${seed}-${i}` };
  });
}

export function detectedTitleForUpload(fileName: string): string {
  return humanizeFileName(fileName);
}

// In-memory store for uploaded Smart Studio tests (Phase 1 has no real file storage/DB).
// PHASE2: replace with a Supabase table (`smart_studio_tests`) + object storage for the source file.
export const SMART_STUDIO_TESTS: SmartStudioTest[] = [
  {
    id: "sst-seed-001",
    fileName: "Chapter 4 Practice Test.pdf",
    fileType: "application/pdf",
    fileSizeBytes: 482_331,
    uploadedAt: "2026-07-10T14:20:00.000Z",
    status: "ready",
    detectedTitle: "Chapter 4 Practice Test",
    questions: recognizeQuestionsForUpload("Chapter 4 Practice Test.pdf", 482_331),
    lastResult: undefined,
  },
];

function humanizeSourceName(sourceName: string): string {
  const withoutProtocol = sourceName.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const withoutQuery = withoutProtocol.split(/[?#]/)[0] ?? withoutProtocol;
  const withoutExtension = withoutQuery.replace(/\.[^/.]+$/, "");
  const spaced = withoutExtension.replace(/[/_-]+/g, " ").trim();
  if (spaced.length === 0) return "Uploaded Exam";
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function detectedTitleForUploadedExam(sourceName: string): string {
  return humanizeSourceName(sourceName);
}

/** Deterministically assembles a plausible timed exam from the question bank for an uploaded/URL-sourced test. */
export function buildUploadedExamModules(
  examType: ExamType,
  sourceName: string,
): { modules: ExamModule[]; questionsById: Record<string, Question> } {
  const pool = QUESTION_BANK.filter((q) => q.examType === examType);
  const seed = hashSeed(sourceName);
  const questionCount = Math.min(pool.length, 6 + (seed % 3)); // 6-8 questions
  const start = seed % pool.length;
  const picked = Array.from({ length: questionCount }, (_, i) => pool[(start + i) % pool.length]!);

  const domains = Array.from(new Set(picked.map((q) => q.domain)));
  const modules: ExamModule[] = domains.map((domain, i) => {
    const domainQuestions = picked.filter((q) => q.domain === domain);
    return {
      id: `upload-${seed}-module-${i}`,
      title: `Module ${i + 1}: ${domain}`,
      domain,
      durationSeconds: domainQuestions.length * 90,
      questionIds: domainQuestions.map((q) => q.id),
    };
  });

  const questionsById: Record<string, Question> = {};
  for (const q of picked) questionsById[q.id] = q;

  return { modules, questionsById };
}

// In-memory store for user-uploaded/URL-extracted exams (Phase 1 has no real file storage/DB).
// PHASE2: replace file parsing with real OCR/document-extraction, and URL sourcing with a sandboxed
// fetch pipeline (domain allowlist, timeouts, size caps, private-IP blocking) run by an Extraction Agent.
export const UPLOADED_EXAMS: UploadedExam[] = [];
