# SmartGenCoach — Production Codebase Documentation

Documents the codebase as it stands after a full audit/fix/optimize/test pass. It is a
companion to `README.md` (which stays the quick-start / getting-started doc) — this file is the
deeper architectural and operational reference.

---

## 1. Project Overview

**SmartGenCoach** is an AI-driven test-prep platform for three exams: the **Digital SAT (DSAT)**,
**AP Exams** (Calculus, US History), and **IELTS**. Its core differentiator is that every practice
question is generated on demand by Claude (Anthropic) rather than served from a static bank, and
the DSAT full exam mode reproduces the real College Board Bluebook app's structure: two adaptive
modules per section, official content-domain ordering, ~25% grid-in ("student-produced response")
Math questions, and 2 unscored "pretest" questions per module excluded from scoring.

**Target users**: students preparing for these exams, individually or in small groups (via the
real-time "Let's Play" multiplayer trivia mode), plus a small admin role for user-directory
visibility.

**Main functionality**:
- Full timed exams (DSAT, AP, IELTS) with section-appropriate UI (Bluebook-style split-screen for
  DSAT, audio playback for IELTS Listening, microphone capture for IELTS Speaking).
- Skill Practice — focused drilling of one sub-skill at a time, with AI-generated tips on missed
  skills.
- Killing Questions — targeted practice on a student's weakest tracked skills, gated behind a
  readiness threshold.
- Smart Studio — upload a past exam (PDF/image) and have Claude extract it into a gradable test.
- Upload Exam — upload a document or URL and have it rebuilt into a full timed exam.
- Let's Play — real-time multiplayer trivia rooms (Supabase Realtime + Postgres RPCs).
- Ask AI — a floating chat widget for exam-related questions.
- Dashboard & Admin — per-exam readiness scoring and an admin user directory.

---

## 2. Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.4 (App Router, Turbopack) |
| Language | TypeScript 5 (strict mode) |
| UI | React 19.2 (React Compiler), Tailwind CSS 4, Framer Motion, lucide-react |
| Client state | Zustand 5 (with `persist` middleware for the auth cache) |
| Auth / DB / Realtime | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — Postgres + RLS |
| AI | `@anthropic-ai/sdk` (Claude, tool-use for structured generation) |
| Linting | ESLint 9, `eslint-config-next` (React Compiler's stricter hooks rules) |
| Package manager | npm |
| Testing | None configured — see [§14 Known Limitations](#14-known-limitations) |
| Deployment | Vercel (inferred from `vercel[bot]` PR checks; no `.github/workflows` CI) |

---

## 3. Architecture

### 3.1 Overall shape

A single Next.js app: React Server/Client Components under `app/`, a thin API layer under
`app/api/*/route.ts`, a services layer under `lib/services/*` holding all business logic and
external calls (Supabase queries, Anthropic calls), and Supabase as the sole backend (Postgres +
Auth + Realtime — no separate backend server).

```
Browser (React Client Components)
   │  fetch()
   ▼
app/api/**/route.ts   (thin: parse request → auth/rate-limit guard → call a service → NextResponse)
   │
   ▼
lib/services/*.ts     (business logic: Supabase queries, Anthropic calls, validation)
   │
   ├──▶ Supabase Postgres (profiles, lets_play_*)   — real persistence, RLS-protected
   ├──▶ Anthropic API (Claude)                       — question generation, extraction, Ask AI
   └──▶ In-memory arrays (lib/mockData.ts)           — Phase 1 stand-ins, explicitly marked PHASE2
```

### 3.2 Frontend architecture

- **Route groups**: `app/(auth)/*` (login/register/forgot-password/reset-password — public) and
  `app/(app)/*` (dashboard, select-exam, killing-questions, smart-studio, admin, lets-play — all
  wrapped in `AuthGuard` via `app/(app)/layout.tsx`). Full timed exams live outside both groups,
  directly under `app/exam/*` (each page manages its own auth check via the shared `useAuthStore`).
- **Client state** (`lib/store/*`): `authStore` (session cache, persisted to `localStorage`),
  `dsatExamStore`/`examRunnerStore` (in-progress exam answers/navigation, not persisted —
  intentionally lost on refresh, matching a real timed-exam's behavior), `letsPlayStore`,
  `themeStore`.
- **Services consumed from the client** are always via `fetch()` to `app/api/*` — no client
  component imports a `lib/services/*` file that itself imports the Anthropic SDK or a Supabase
  server client (verified: those imports are type-only where they cross that boundary, so the
  Anthropic SDK never ends up in the client bundle).

### 3.3 Backend / API architecture

Every route handler under `app/api/` follows the same shape:
1. `requireSession()` or `requireAdminSession()` (`lib/services/apiAuth.ts`) — 401/403 short-circuit.
2. For every Anthropic-calling route: `requireRateLimit()` — 429 short-circuit.
3. Input validation (query params, JSON body, or `FormData`) — 400 on anything malformed.
4. Call into `lib/services/*` for the actual work.
5. `NextResponse.json(...)` with a sanitized error message on failure (never a raw exception).

`proxy.ts` (Next 16's replacement for `middleware.ts`) → `lib/supabase/middleware.ts` gates **page
navigations only** (by pathname prefix) — it does not protect `/api/*`, which is why every route
handler enforces its own session check rather than relying on the middleware.

### 3.4 Database architecture

Postgres via Supabase, defined across three hand-applied SQL files (no Supabase CLI or
`supabase/migrations/` — see `docs/runbooks/*.md` for the apply procedure):

- `supabase/schema.sql` — `public.profiles` (one row per `auth.users` row, auto-created by a
  trigger) with RLS.
- `supabase/admin_schema.sql` — `admin_list_profiles()`, a `security definer` RPC that lets an
  admin read every profile despite RLS restricting normal SELECTs to one's own row.
- `supabase/lets_play_schema.sql` — `lets_play_rooms`/`lets_play_players`/`lets_play_answers` with
  RLS, plus three `security definer` RPCs (`lets_play_advance_question`,
  `lets_play_set_room_status`, `lets_play_submit_answer`) that are the only way to mutate room
  state, and Realtime publication membership for all three tables.

Smart Studio tests and Upload Exam documents are **not** in Postgres — they live in per-process
in-memory arrays (`lib/mockData.ts`'s `SMART_STUDIO_TESTS`/`UPLOADED_EXAMS`), explicitly marked
`PHASE2` for a real Supabase table + object storage. See [§14](#14-known-limitations).

### 3.5 Authentication architecture

Supabase Auth (email/password) via `@supabase/ssr`, PKCE flow. Three layers, each with a distinct
job (deliberately not collapsed into one):

1. **`proxy.ts`** — the real security boundary for pages. Redirects an unauthenticated request for
   a protected page path to `/login` before any component renders.
2. **`lib/services/apiAuth.ts`'s `requireSession()`/`requireAdminSession()`** — the real security
   boundary for API routes, called individually by every route handler (proxy.ts does not cover
   `/api/*`).
3. **`AuthGuard`/`AdminGuard`** (`components/layout/*.tsx`) — client-side UI layer only. Renders a
   spinner while confirming the session, keeps a `localStorage`-persisted UI cache (name, avatar,
   role) in sync with the server, and reconciles that cache against the server once per mount even
   when a cached session is already present (so a stale cache from a closed tab / crashed browser
   on a shared machine is corrected proactively, not trusted indefinitely) — see the code comments
   in `AuthGuard.tsx` for why this is explicitly *not* the security boundary.

### 3.6 Data flow example — taking a DSAT exam

```
User clicks "Start DSAT exam"
  → app/exam/dsat/page.tsx fetches GET /api/exam/dsat
    → requireSession() + requireRateLimit()
    → examService.getDsatExamBundle()
      → runDsatCallGroups() fires up to 4 concurrent Claude calls (2 content domains × 2 modules,
        capped by mapWithConcurrency) via examQuestionGenerator.generateExamQuestions()
      → orderDsatModuleQuestions() reconstructs official content-domain block order
      → markPretestQuestions() flags 2 questions per module as scored: false
    ← DsatExamBundle (modules + questionsById) returned as JSON
  → student answers Module 1; on advance, isAnswerCorrect() (format-aware: grid-in vs
    multiple-choice) scores only the `scored !== false` questions
  → POST /api/exam/dsat/adaptive-module generates Module 2 at Easy or Hard difficulty based on
    that score (routeModule2Difficulty() — a documented approximation of College Board's
    undisclosed real IRT-based routing)
```

---

## 4. Project Structure

```
app/
├── (app)/                  # Authenticated app shell — wrapped in AuthGuard
│   ├── admin/               # Admin user directory (AdminGuard on top of AuthGuard)
│   ├── dashboard/
│   ├── killing-questions/
│   ├── lets-play/           # Lobby + [code] room pages
│   ├── select-exam/
│   ├── smart-studio/
│   └── layout.tsx           # Wraps children in <AuthGuard>
├── (auth)/                  # Public — login/register/forgot-password/reset-password
├── exam/                    # Full timed exams (DSAT/AP/IELTS/upload/practice) — own auth checks
├── api/                     # Route handlers, one dir per route (see §7 API Documentation)
├── layout.tsx, page.tsx     # Root layout + landing page
└── globals.css

components/
├── exam/                    # BluebookLayout, CalculatorModal, quiz components, Let's Play UI
├── layout/                  # AuthGuard, AdminGuard, TopNav, ThemeProvider/Toggle, AskAiWidget
└── ui/                      # Button, Card, Input, Badge, ProgressBar/Ring, Spinner, StatChart

lib/
├── services/                # All business logic + external calls (Supabase, Anthropic)
├── store/                   # Zustand stores
├── supabase/                # client.ts (browser), server.ts (RSC/route handlers), middleware.ts
├── utils/                   # cn, accent, gridIn (answer-correctness), small pure helpers
├── constants/
├── types.ts                 # Shared frontend/backend type contract
├── mockData.ts               # Phase-1 in-memory data + generators, PHASE2-tagged throughout
└── examMeta.ts               # EXAM_TYPES / EXAM_META / isExamType — single source of truth

hooks/                       # useCountdown, useExamTheme, useResetOnKeyChange, useSpeakingRecorder
supabase/                    # Hand-applied SQL: schema.sql, admin_schema.sql, lets_play_schema.sql
docs/runbooks/               # Step-by-step Supabase Dashboard apply procedures
```

This mirrors Next.js's own App Router convention (`app/` for routes, colocated route handlers)
rather than the generic `src/` layout — the right choice here since the framework's own file-system
routing already defines the top-level structure.

---

## 5. Major Components

| Component | Responsibility |
|---|---|
| `lib/services/apiAuth.ts` | `requireSession`/`requireAdminSession` (401/403 guards), `requireRateLimit` (429 guard) — every API route calls these before doing real work. |
| `lib/services/rateLimiter.ts` | In-memory, per-instance, per-user-per-route fixed-window rate limiter. |
| `lib/services/examService.ts` | DSAT/AP/IELTS full-exam assembly: content-domain ordering, adaptive Module 2 routing, pretest marking, concurrency-capped Claude call batching. |
| `lib/services/examQuestionGenerator.ts` | The shared low-level Claude call generating a batch of fresh questions (multiple-choice or grid-in) for a set of skill slots — backs both full-exam assembly and Skill Practice. |
| `lib/utils/gridIn.ts` | Format-aware answer-correctness check (grid-in numeric equivalence vs. multiple-choice exact match). |
| `lib/services/smartStudioService.ts` | Document/image → extracted questions via Claude vision; per-user in-memory test storage and grading. |
| `lib/services/uploadedExamService.ts` | Document/URL → full assembled exam via Claude; includes SSRF-hardened URL fetching (private-IP blocking, redirect re-validation, size/timeout caps). |
| `lib/services/killingQuestionsService.ts` | Targeted-practice question selection based on a user's weakest tracked skills. |
| `lib/services/readinessService.ts` / `skillService.ts` | Per-user readiness scoring and skill-mastery aggregation. |
| `lib/services/authService.ts` | Thin wrapper over Supabase Auth (login/register/reset/session), with network-failure guarding and email-enumeration-safe error messages. |
| `lib/services/adminService.ts` | Calls the `admin_list_profiles()` RPC for the real (non-mock) admin directory. |
| `lib/services/letsPlayService.ts` | Room CRUD + Realtime subscription wiring for Let's Play. |
| `components/layout/AuthGuard.tsx` / `AdminGuard.tsx` | Client-side session/role confirmation and cache reconciliation (UI layer, not the security boundary). |
| `components/exam/BluebookLayout.tsx` | Shared split-screen exam chrome (timer, navigator, directions, calculator toggle) modeled on the real Bluebook app. |
| `components/exam/CalculatorModal.tsx` | Draggable on-screen scientific calculator with a hand-written expression parser (no `eval()`). |
| `lib/store/authStore.ts` | Persisted (`localStorage`) client cache of the current user's profile — UI convenience only. |

---

## 6. Data Model

### 6.1 `public.profiles` (Postgres, RLS-protected)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `references auth.users(id) on delete cascade` |
| `name` | `text` | |
| `email` | `text` | |
| `avatar_initials` | `text` | |
| `target_exams` | `text[]` | |
| `target_scores` | `jsonb` | |
| `role` | `text` | `check (role in ('user','admin'))`, default `'user'` |
| `created_at` | `timestamptz` | |

Auto-created by the `handle_new_user()` trigger on `auth.users` insert. RLS: a user can `SELECT`
and `UPDATE` only their own row; `UPDATE` is further restricted by a `with check` clause so `role`
cannot be changed via the self-service policy (see [§9 Bug Fixes](#9-bug-fixes)). Listing every
profile (admin directory) goes through the `security definer` `admin_list_profiles()` RPC, which
checks the caller is an admin before returning anything.

### 6.2 Let's Play tables (Postgres, RLS-protected)

| Table | Key columns | Notes |
|---|---|---|
| `lets_play_rooms` | `id`, `code` (unique), `host_id`, `exam_type`, `domain`, `questions` (jsonb), `status`, `current_question_index/id/winner`, `current_question_started_at` | Full generated question set (including answer keys) is stored client-visible — matches this app's existing no-server-authoritative-anti-cheat posture everywhere else (`correctChoiceId` ships to the client up front in every other exam mode too). |
| `lets_play_players` | `id`, `room_id`, `user_id`, `name`, `avatar_initials`, `score` | `unique(room_id, user_id)`. |
| `lets_play_answers` | `id`, `room_id`, `question_id`, `user_id`, `choice_id`, `is_correct`, `points` | `unique(room_id, question_id, user_id)`; all writes go through `lets_play_submit_answer()`. |

All three tables' `SELECT` policies are `auth.role() = 'authenticated'` (any signed-in user, not
scoped to room membership) — a deliberate, documented design choice (see the file's own comments)
so a room can be looked up and joined by code without a separate membership pre-check; reviewed in
this pass and accepted as a reasonable tradeoff for a low-stakes, ephemeral trivia feature that
already has no server-authoritative anti-cheat anywhere else.

### 6.3 In-memory (Phase 1, not in Postgres)

`SmartStudioTest` and `UploadedExam` (see `lib/types.ts`) — each now carries a `userId` field (this
session's fix; see [§9](#9-bug-fixes)) and is stored in a plain array in `lib/mockData.ts`, filtered
by `userId` on every read. Resets on every server cold start / redeploy — see
[§14](#14-known-limitations).

### 6.4 Core shared types (`lib/types.ts`)

`Question` (the universal exam-question shape, with optional `format`/`acceptedAnswers`/`scored`
fields for DSAT grid-in and pretest support), `ExamAttempt`, `SkillScore`, `ReadinessReport`,
`UserProfile`/`AuthSession`, `AdminUserRow`. All backend-agnostic by design (a `PHASE2` comment at
the top of `lib/types.ts` notes these become the eventual DB schema / agent I/O contract).

---

## 7. API Documentation

All routes are under `/api`. Unless noted "public," every route requires a valid Supabase session
(`requireSession()`) and returns `401 {"error": "Not authenticated"}` otherwise. Routes marked
"admin" additionally require `role === "admin"` and return `403 {"error": "Forbidden"}` otherwise.
Routes marked "rate-limited" return `429 {"error": "Too many requests..."}` with a `Retry-After`
header once the per-user-per-route quota is exceeded (see `lib/services/rateLimiter.ts`).

| Method | Route | Purpose | Auth | Rate-limited |
|---|---|---|---|---|
| POST | `/api/auth/login` | Sign in | Public | No |
| POST | `/api/auth/register` | Create account | Public | No |
| POST | `/api/auth/forgot-password` | Send password-reset email | Public | Yes (by IP) |
| POST | `/api/auth/reset-password` | Set new password (recovery session) | Session | No |
| GET | `/api/auth/session` | Current session (used by `AuthGuard`) | Session | No |
| GET | `/api/dashboard` | Per-user dashboard data | Session | No |
| GET | `/api/readiness` | Readiness report(s), one exam or all | Session | No |
| GET | `/api/admin/users` | Full user directory | Admin | No |
| POST | `/api/ask-ai` | Ask AI chat turn | Session | Yes (20/10min) |
| GET | `/api/exam/dsat` | Generate DSAT Module 1 bundle | Session | Yes (5/10min) |
| POST | `/api/exam/dsat/adaptive-module` | Generate DSAT Module 2 at routed difficulty | Session | Yes (10/10min) |
| GET | `/api/exam/ap` | Generate AP exam bundle | Session | Yes (5/10min) |
| GET | `/api/exam/ielts` | Generate/serve one IELTS section | Session | Yes (10/10min) |
| GET | `/api/exam/questions` | Skill Practice / Let's Play question set | Session | Yes (15/10min) |
| GET, POST | `/api/exam/upload` | List / create an uploaded exam | Session | POST: Yes (10/10min) |
| GET | `/api/exam/upload/[id]` | Fetch one uploaded exam (owner-only) | Session | No |
| GET | `/api/killing-questions` | Targeted-practice question set | Session | Yes (10/10min) |
| GET, POST | `/api/smart-studio` | List / upload a Smart Studio test | Session | POST: Yes (10/10min) |
| GET | `/api/smart-studio/[id]` | Fetch one test (owner-only) | Session | No |
| POST | `/api/smart-studio/[id]/submit` | Grade a submission (owner-only) | Session | No |
| GET | `/api/smart-studio/[id]/answer-key` | Fetch answer key (owner-only) | Session | No |

**Error behavior**: every route returns `{"error": "<message>"}` with an appropriate status —
`400` for malformed/missing input (including invalid JSON bodies, guarded on every route that
parses one), `401`/`403` for auth failures, `404` for a real-but-not-yours or nonexistent resource
(indistinguishable — see [§9](#9-bug-fixes)), `422` for a well-formed request that fails downstream
validation (e.g. an unsupported file type), `429` for rate-limit, `502` for an upstream Anthropic
failure. No route ever returns a raw exception message, stack trace, or raw Supabase error text
that could reveal internals or enable account enumeration (see [§9](#9-bug-fixes) for the one
enumeration-relevant case that was found and fixed).

`/api/dashboard`, `/api/readiness`, and `/api/admin/users` additionally set
`export const dynamic = "force-dynamic"`, `export const revalidate = 0`, and a `Cache-Control:
no-store, no-cache, must-revalidate` response header — defense-in-depth against per-user data being
cached and served to a different user.

---

## 8. Authentication & Security

### 8.1 Authentication

Supabase Auth, email/password, PKCE flow (`@supabase/ssr` browser client). Session cookie is
HttpOnly and managed entirely by Supabase's SSR helpers (`lib/supabase/client.ts`/`server.ts`); the
app never handles raw tokens itself except to pass through `access_token`/`expires_at` into the
lightweight `AuthSession` shape used by the UI cache.

### 8.2 Authorization

- **Row-level**: every Postgres table has RLS enabled; no table is ever queried with a
  service-role key from application code (confirmed — no `service_role`/RLS-bypass pattern
  anywhere in `supabase/*.sql` or `lib/services/*`).
- **Route-level**: `requireSession()`/`requireAdminSession()` on every API route (see §7).
- **Resource-level (ownership)**: Smart Studio tests and Upload Exam documents are scoped to the
  requesting user's `userId` on every read (fixed this pass — see §9). Let's Play's read policies
  are intentionally broader (any authenticated user, not room-scoped) — see §6.2.

### 8.3 Session handling

Server-side: Supabase's own cookie-based session, refreshed by `lib/supabase/middleware.ts` /
`proxy.ts` on every navigation. Client-side: `useAuthStore` keeps a `localStorage`-persisted
*display* cache (name/avatar/role) for instant UI, explicitly documented as not the security
boundary; `AuthGuard` reconciles it against the real server session on every mount rather than
trusting a persisted cache indefinitely, and `TopNav`'s logout always clears the cache and redirects
even if the underlying `signOut()` call itself fails.

### 8.4 Security controls added/verified in this pass

- **Rate limiting** on every Anthropic-calling endpoint plus the public forgot-password endpoint
  (§7, §9).
- **`profiles` self-promotion-to-admin RLS gap closed** (§9).
- **IDOR closed** on Smart Studio and Upload Exam (§9).
- **Dependency CVEs patched**: `npm audit` reported a critical Next.js unauthenticated-RCE
  advisory (plus bundled `postcss`/`sharp` CVEs) and a high-severity `nanoid` issue; fixed by
  bumping `next`/`eslint-config-next` to `16.3.4` and running `npm audit fix`. `npm audit
  --production` now reports **0 vulnerabilities**.
- **SSRF protections** in `uploadedExamService.ts`'s URL-sourced exam creation (private-IP
  blocking, redirect re-validation, size/timeout limits) — reviewed and confirmed sound, no changes
  needed.
- **No secrets in the repository** — `.env.local` is git-ignored; no API keys, tokens, or
  credentials appear in any tracked file (verified by review of every file touched in this pass).

### 8.5 Secret management

Two environment variables required at runtime: `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design — the anon key is safe to expose, RLS is the real
gate) and `ANTHROPIC_API_KEY` (server-only, never sent to the client — confirmed no client
component or client-bundled module imports it). No `.env.example` is checked in yet (see
[§14](#14-known-limitations)).

---

## 9. Bug Fixes

Findings and fixes from this audit pass, most severe first. Each was verified — see §11 for how.

| Issue | Root Cause | Fix | Verification |
|---|---|---|---|
| Critical: `profiles` RLS allowed self-promotion to admin | `"Users can update their own profile"` UPDATE policy had no `with check` clause restricting which columns could change | Added a `with check` clause pinning `role` to its pre-statement value (`supabase/schema.sql`) | Reviewed the policy SQL; documented apply/verification steps in `docs/runbooks/apply-profiles-rls-fix.md` (requires a live Supabase session to execute — can't be run from this sandbox) |
| Critical: Smart Studio & Upload Exam had no per-user data isolation (IDOR) | `getUserTests()`/`getTest()`/`gradeSubmission()`/`getAnswerKey()`/`getUploadedExams()`/`getUploadedExam()` read a shared in-memory array with zero `userId` filtering | Added a `userId` field to both stored types, set at creation from the authenticated session, and filtered every getter by it | Standalone test simulating two users confirmed: each sees only their own tests in a list, cannot fetch/grade/read the answer key for another user's test by id (returns the same "not found" as a nonexistent id) — 7/7 checks passed |
| High: no rate limiting on any Anthropic-calling endpoint | No rate-limiting code existed anywhere in the codebase | Added `lib/services/rateLimiter.ts` (in-memory fixed-window limiter) wired into `requireRateLimit()` and called from all 8 AI-calling routes plus the public forgot-password route | Standalone test of the limiter (allow/block/reset/independent-keys/retry-after) — 5/5 passed; confirmed via `grep` that all 8 routes call it |
| High: stale/failed auth state could strand the UI or leave a previous user's identity displayed | `AuthGuard`'s session fetch had no `.catch()` (network failure = infinite spinner); `TopNav`'s `handleLogout` had no error handling (a failed `signOut()` left the local session cache live); a cached session was never re-verified once present | Added `.catch()` treating a fetch failure as unauthenticated; wrapped `signOut()` in `try/finally` so the cache always clears and the redirect always happens; added a background reconciliation fetch that runs once per mount even when a cached session exists | `tsc`/lint/build clean; logic reviewed line-by-line; not independently live-testable without real Supabase credentials |
| Medium: several routes returned 500 instead of a proper status | `smart-studio/[id]/submit` and `.../answer-key` didn't catch the service layer's `"Test not found"` throw; several POST routes' `request.json()` calls weren't guarded, so malformed JSON threw uncaught | Added try/catch around both; malformed-JSON now returns `400`, not-found now returns `404` | `tsc`/lint/build clean; code reviewed against the exact failure paths described |
| Medium: registration could be used to enumerate existing accounts | `signUp()`'s `"User already registered"`-class error (`error.code === "user_already_exists"`) was surfaced verbatim, differing from the generic "check your inbox" message shown for a genuinely new signup | Rewrote that specific error code to the same generic message used for the real "check your inbox" case — every other `signUp` validation error (weak password, invalid format) is still surfaced as-is, since those are genuine Supabase-authored user-facing text with no enumeration risk | Reviewed against the real Supabase `error-codes.ts` source in `node_modules` to confirm the exact code string; `tsc` clean |
| Low: 3 duplicated `isExamType`/`VALID_EXAM_TYPES` definitions | Each of `readiness`, `killing-questions`, and `exam/questions` routes independently redefined the same exam-type validator | Consolidated into `lib/examMeta.ts`'s single `isExamType()`, imported everywhere | `tsc`/lint clean; `grep` confirmed no remaining duplicates |
| Low: dead mock code (`SMART_STUDIO_QUESTION_POOL` and its helpers, ~170 lines) | Superseded by real Claude-based extraction but never removed; the seed `SmartStudioTest` that used it had no `userId` and became unreachable once ownership filtering was added | Removed the pool, its two accessor functions, and the seed record; kept `hashSeed()` (still used elsewhere) | `tsc`/lint clean; confirmed no other importer via `grep` |
| Low: `AdminGuard` redirected "not logged in" to `/dashboard` instead of `/login` | Derived only from `session?.user.role`, not whether a session existed at all | Now redirects to `/login` when there's no session, `/dashboard` only for a real non-admin session | `tsc`/lint/build clean |
| Low: Calculator modal never received initial focus | No `.focus()` call on mount despite `role="dialog"` and a keyboard-shortcut handler on the container | Added a ref + mount effect that focuses the dialog container | `tsc`/lint/build clean |
| Low: DSAT/AP exam-bundle fetch had no unmount guard | Rapid navigate-away-and-back could let a stale in-flight fetch overwrite fresher state | Added a `cancelled` flag, matching the pattern already used in `lets-play/[code]/page.tsx` | `tsc`/lint/build clean |

---

## 10. Performance Optimizations

This pass found the frontend architecture already sound (no missing cleanup, no unstable list
keys, no unguarded double-submission — see the frontend audit summary in this session's history)
and did not find load-time or rendering bottlenecks worth restructuring. Concrete, verified changes
made:

- **Dependency currency**: `next`/`eslint-config-next` bumped `16.2.11` → `16.3.4` (patch/minor,
  no breaking changes encountered — full `tsc`/lint/build/E2E pass stayed green). This is a
  correctness/security fix, not a perf one, but is recorded here since it's the only dependency
  change made.
- **Dead code removed**: ~170 lines of superseded mock-data generation code deleted from
  `lib/mockData.ts` (see §9), reducing bundle input size for a module already imported broadly.
- **Bundle composition verified**: confirmed `@anthropic-ai/sdk` (and every `lib/services/*` file
  that imports it) is never reachable from a client component — only `type`-only imports cross that
  boundary, so the SDK is not bundled to the browser. All four heavier client dependencies
  (`framer-motion`, `lucide-react`, `canvas-confetti`, `zustand`) were confirmed genuinely used
  across dozens of files, not dead weight.

**Before/after measurement**: a clean production build's combined static JS chunk output was
measured at **1.3 MB** across all routes (`du -ch .next/static/chunks/*.js`) both before and after
this pass's changes — none of the fixes changed client-bundle-affecting code paths, so no
regression or improvement was expected or observed here. No before/after Core Web Vitals numbers
are available (no live browser/Lighthouse run against a deployed instance was possible in this
sandbox — see §14).

---

## 11. Testing

No automated test suite exists in this repository (`package.json` has no `test` script; no
`.github/workflows`). Verification in this pass, at every step, consisted of:

- **Type checking**: `npx tsc --noEmit` — run after every batch of changes, clean throughout.
- **Linting**: `npm run lint` (ESLint 9 + `eslint-config-next`, including React Compiler's
  stricter hooks rules) — run after every batch of changes; the two pre-existing warnings found at
  the start (`ReadinessReport` unused import, one stale `eslint-disable` comment) were fixed as
  part of the cleanup pass. Currently: **0 errors, 0 warnings**.
- **Production build**: `npm run build` — run after every batch of changes, clean throughout,
  including the final state.
- **Unit-level standalone verification** (no test runner configured, so run as one-off `tsx`
  scripts against the actual committed files, not hand-copied logic):
  - `lib/utils/gridIn.ts` numeric-equivalence logic — 13/13 cases (fractions, decimals, multiple
    valid answers, non-numeric/garbled input, division-by-zero, floating-point tolerance).
  - `lib/services/rateLimiter.ts` — 5/5 behaviors (allow-under-limit, block-over-limit,
    independent-per-key, reset-after-window, correct `retryAfterSeconds`).
  - `lib/services/smartStudioService.ts` ownership scoping — 7/7 checks simulating two distinct
    users, confirming the IDOR fix actually prevents cross-user access (§9).
- **End-to-end (Playwright, against a local production build)**: 21/21 checks passed —
  every public page renders with zero console/page errors; every protected page correctly redirects
  an unauthenticated visitor to `/login`; every protected API route correctly returns `401` for an
  unauthenticated request.
- **Regression testing**: the full type-check/lint/build cycle was re-run after *every* fix in this
  pass (not batched at the end), and the E2E sweep was re-run once at the end against the final
  combined state.

**What could not be tested** (no live Supabase project or `ANTHROPIC_API_KEY` in this sandbox):
- Real Claude-generated question content/quality, timing, and retry behavior under real load.
- The actual Postgres RLS fix's live enforcement (the SQL was reviewed and is correct by
  inspection, but applying and testing it requires a live Supabase Dashboard session — see
  `docs/runbooks/apply-profiles-rls-fix.md`).
- Real multi-account behavior (dashboard scoping, admin directory, Let's Play multiplayer) beyond
  what the code logic and standalone simulations could verify.
- Actual rate-limit behavior under concurrent real traffic (verified the limiter's logic in
  isolation, not its behavior wired through a live Next.js server under load).
- Browser-level accessibility tools (screen reader, axe) — the calculator focus fix and existing
  label/aria coverage were verified by code review, not a live assistive-technology pass.

---

## 12. Deployment

**Required environment variables** (see `README.md` for the full setup walkthrough):

| Variable | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Every page (proxy.ts throws without it) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Every page |
| `ANTHROPIC_API_KEY` | Every AI-generated feature (full exams, Killing Questions, Smart Studio, Upload Exam, Ask AI) |

No secret values are recorded anywhere in this document or the codebase.

**Build commands**:
```bash
npm install
npm run build   # next build (Turbopack)
npm run start   # serves the production build
```

**Database setup**: apply, in order, via the Supabase Dashboard SQL Editor (no CLI/migrations in
this repo): `supabase/schema.sql` → `supabase/lets_play_schema.sql` → `supabase/admin_schema.sql`.
See `docs/runbooks/*.md` for exact, tested apply/verification procedures, including the
`apply-profiles-rls-fix.md` runbook added in this pass for the self-promotion fix.

**Production configuration notes**:
- `dynamic = "force-dynamic"` / `no-store` headers are set on the three per-user data routes
  (`dashboard`, `readiness`, `admin/users`) — do not add caching in front of these without also
  scoping the cache key by user.
- The rate limiter (`lib/services/rateLimiter.ts`) is in-memory and per-process — on a
  multi-instance deployment (e.g. Vercel scaling to multiple serverless instances), the effective
  rate limit is `configured limit × live instance count`, not the configured limit exactly. This is
  a known, documented tradeoff (see §14), not a bug.
- Smart Studio / Upload Exam data resets on every cold start / redeploy (in-memory, not
  Postgres-backed yet — see §14).

---

## 13. Maintenance Guide

**Adding a feature**: add UI under `app/`, put any Supabase/Anthropic logic in a new or existing
`lib/services/*.ts` file (never call Supabase or Anthropic directly from a component or route
handler), and expose it via a thin `app/api/*/route.ts` that starts with `requireSession()` (and
`requireRateLimit()` if it calls Anthropic) before anything else.

**Fixing a bug**: reproduce via `npm run dev`, fix in the service layer where the logic actually
lives (not in the route handler or the component, which should stay thin), then re-run
`tsc --noEmit`, `npm run lint`, and `npm run build` — this is the only verification loop available
until a test suite exists (see §14/§15).

**Adding a new API route**: it will **not** be protected by `proxy.ts` automatically — you must
call `requireSession()`/`requireAdminSession()` yourself as the very first thing in the handler.
If it calls the Anthropic API, also call `requireRateLimit()` right after, choosing a `routeKey`
and a limit proportional to how expensive/abusable the call is (see the table in §7 for existing
examples).

**Updating dependencies**: run `npm audit` regularly — this pass found and fixed a critical Next.js
RCE advisory that had accumulated silently. Prefer patch/minor bumps for security fixes (as done
this pass for `next`); treat any major-version bump as a separate, carefully-tested change, not a
drive-by fix.

**Running tests**: no automated suite exists yet. Until one is added (see §15), the verification
loop is `npx tsc --noEmit && npm run lint && npm run build`, plus manual exercise of the changed
flow via `npm run dev`.

**Building for production**: `npm run build`; verify the route list in its output matches
expectations (static vs. dynamic) and that it completes with zero TypeScript errors.

**Deploying updates**: push to the tracked branch; this repo's Vercel integration builds a preview
deployment automatically (observed via `vercel[bot]` PR comments) — there is no separate manual
deploy step documented in-repo.

---

## 14. Known Limitations

Genuine, currently-remaining limitations — not exhaustive of every `PHASE2` comment in the
codebase, but everything materially relevant to running this in production:

1. **No automated test suite or CI.** All verification is manual (`tsc`, lint, build, and
   standalone one-off scripts) — see §11.
2. **Smart Studio and Upload Exam data is not persisted to Postgres.** It's an in-memory array,
   now correctly scoped per-user (this pass's fix), but still lost on every cold start/redeploy.
   Needs a real `smart_studio_tests`/`uploaded_exams` table + object storage for source files.
3. **No real exam-attempt persistence for full exams.** Finishing a DSAT/AP/IELTS exam doesn't
   write anywhere yet; nothing feeds real data into readiness scoring, the dashboard, or the admin
   directory's per-user scores.
4. **Rate limiting is in-memory and per-instance**, not a shared store — see §12. Adequate against
   casual abuse, not a hard guarantee under a scaled multi-instance deployment.
5. **No generated-question caching.** Every exam/practice/Killing-Questions load is a fresh,
   billed Claude call, even for identical inputs.
6. **No `.env.example`** — a new contributor must read `README.md`/source to discover the three
   required environment variables.
7. **Let's Play's read-access RLS policies are broader than strict per-room membership** (any
   authenticated user, not just room participants, can read a room's questions/players/answers by
   ID) — reviewed and accepted this pass as a reasonable tradeoff for a low-stakes, ephemeral
   feature with no server-authoritative anti-cheat anywhere else in the app; not treated as a bug,
   but worth knowing if Let's Play's stakes ever increase (e.g. real prizes/rankings).
8. **The `profiles` RLS self-promotion fix must be applied by hand to any already-deployed Supabase
   project** — editing `supabase/schema.sql` in this repository does not retroactively patch a live
   database. See `docs/runbooks/apply-profiles-rls-fix.md`, including how to check for and demote
   any account that may have already exploited the gap before the fix was applied.

---

## 15. Future Improvements

Roughly in priority order (mirrors `README.md`'s "Suggested enhancements," kept in sync):

1. Add a `.env.example`.
2. Cache generated questions against their inputs (exam type, domain, difficulty, skill slots).
3. Add a real test suite: unit tests for the business logic in `lib/services/*` (adaptive
   difficulty, readiness thresholds, Killing Questions targeting, the calculator's expression
   parser, the rate limiter, the grid-in equivalence checker), plus Playwright smoke tests for the
   auth-gated flows end-to-end.
4. Basic CI (`.github/workflows`) running `npm run lint`, `tsc --noEmit`, `npm run build`, and
   `npm audit` on every PR.
5. Move rate limiting to a shared store (Upstash Redis or similar) once real multi-instance traffic
   makes the per-instance limitation matter.
6. Finish the remaining `PHASE2` items: real Supabase-backed persistence for Smart Studio and
   Upload Exam, and real exam-attempt persistence feeding readiness/dashboard/admin scores.
