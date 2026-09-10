# SmartGenCoach

An AI-driven test-prep platform for the **Digital SAT (DSAT)**, **AP Exams** (Calculus, US History),
and **IELTS**. Every question set is generated on demand by Claude rather than pulled from a static
bank, the DSAT module is genuinely multistage-adaptive (like the real Bluebook app), and students can
challenge friends in real-time multiplayer trivia ("Let's Play").

Built with Next.js 16 (App Router, Turbopack, React 19.2 + React Compiler), Supabase (auth + Postgres +
Realtime), and the Anthropic API.

## Features

- **Full timed exams** — DSAT (adaptive two-module Math + Reading & Writing, Bluebook-style split-screen
  UI, on-screen calculator), AP (Calculus, US History), and IELTS (Listening with TTS narration,
  Reading, Writing, Speaking with real microphone capture).
- **Adaptive DSAT Module 2** — difficulty is derived live from the student's own Module 1 performance
  in that domain (`lib/services/examService.ts`), not just AI-generated-but-static content.
- **Skill Practice** — drill a single sub-skill until it clicks.
- **Killing Questions** — freshly generated questions targeting a student's weakest tracked skills,
  gated behind a readiness threshold.
- **Smart Studio** — upload a past exam (file or URL) and have it rebuilt into a new, full timed exam
  with an answer key.
- **Let's Play** — real-time multiplayer trivia rooms (Supabase Realtime + Postgres RPCs); see
  `docs/runbooks/apply-lets-play-schema.md` for backend setup.
- **Ask AI** — a floating widget for exam-related questions, with basic text-safety filtering.
- **Dashboard & Admin** — per-exam readiness scoring, weakest-skill tracking, and an admin user
  directory (see [Known limitations](#known-limitations)).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19.2 (React Compiler), Tailwind CSS 4, Framer Motion, lucide-react |
| State | Zustand |
| Auth/DB/Realtime | Supabase (`@supabase/ssr`) |
| AI | `@anthropic-ai/sdk` (Claude) |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```bash
# Supabase project — required for every page. Without these, proxy.ts (the auth middleware)
# throws on every request and the whole site 500s, including public pages.
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Anthropic — required for every AI-generated feature (full exams, Killing Questions, Smart
# Studio, Ask AI). Without it those endpoints return a friendly "Something went wrong talking
# to the AI" error; everything else in the app still works.
ANTHROPIC_API_KEY=sk-ant-...
```

There is no `.env.example` checked in yet — see [Suggested enhancements](#suggested-enhancements).

### 3. Set up the database

Apply, in order, via the Supabase Dashboard SQL Editor (this project has no Supabase CLI or
migrations directory — see `docs/runbooks/apply-lets-play-schema.md` for the established pattern):

1. `supabase/schema.sql` — core tables (profiles, auth-linked data, etc.).
2. `supabase/lets_play_schema.sql` — Let's Play rooms/players/answers, RPCs, and Realtime
   publication membership. Follow the runbook doc linked above exactly; the last three
   `alter publication` statements are **not** safe to re-run as-is.
3. `supabase/admin_schema.sql` — the `admin_list_profiles()` RPC backing the real admin user
   directory. Safe to re-run (`create or replace function`).

A fresh `supabase/schema.sql` run already includes the self-promotion RLS fix (see limitation #7
below). If your project was set up **before** that fix was added to this file, apply it separately
via `docs/runbooks/apply-profiles-rls-fix.md` — a plain re-run of `schema.sql` also works since its
policy statements are idempotent (`drop policy if exists` + `create policy`).

To make a user an admin (there's no self-service UI for this — `role` is deliberately not settable
by a signed-up user, see limitation #7 below): `update public.profiles set role = 'admin' where
email = '...';` in the SQL Editor.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build (Turbopack)
npm run start   # serve the production build
npm run lint    # ESLint, including React Compiler's stricter hooks rules
```

## Architecture notes

- **Route groups**: `app/(auth)` (login/register, unauthenticated) and `app/(app)` (dashboard,
  select-exam, killing-questions, smart-studio, admin, lets-play — wrapped in `AuthGuard`). Full
  timed exams live outside both groups, directly under `app/exam/*`.
- **Auth boundary**: `proxy.ts` → `lib/supabase/middleware.ts` gates page navigations by pathname
  (`PROTECTED_PREFIXES`) — this only covers pages, not API routes, so it's a routing detail worth
  double-checking whenever a new top-level *page* is added. `AuthGuard` (see the comment in
  `components/layout/AuthGuard.tsx`) is a client-side confirmation layer on top of it, not a
  replacement. Every route handler under `app/api/` enforces its own session check via
  `lib/services/apiAuth.ts`'s `requireSession()`/`requireAdminSession()` — see the note in
  [Known limitations](#known-limitations) about why that lives per-route instead of in the
  middleware.
- **Services layer** (`lib/services/*`): all data access and Claude calls are isolated here behind
  plain async functions, decoupled from the mock data in `lib/mockData.ts`. Look for `PHASE2`
  comments — they mark exactly where a function currently returns mock/static data and what the
  real Supabase-backed replacement should look like.
- **Generated-question caching**: none yet — every exam/practice/killing-questions load is a fresh
  Claude call. Fine for a demo, costly at any real traffic volume.

## Known limitations

Found while exercising the app end-to-end (dev server, real HTTP requests, no live Supabase/Anthropic
credentials — see below for what that does and doesn't cover). Items 1–3 were fixed after being
found; the fix approach is worth understanding since it shapes how new routes/pages should be added.

1. ~~Most API routes had no server-side auth check~~ **Fixed.** `proxy.ts`'s `PROTECTED_PREFIXES`
   (`lib/supabase/middleware.ts`) only ever matches page paths like `/dashboard` — it never matches
   an API route's actual path (`/api/dashboard`), even though the middleware's matcher runs on
   `/api/*` too. Of 19 route handlers under `app/api/`, only 2 called `getCurrentSession()`
   themselves; the other 17 — including every Claude-backed generation endpoint — were confirmed
   publicly callable with no session cookie. Fixed by giving every route handler its own
   `requireSession()`/`requireAdminSession()` call (`lib/services/apiAuth.ts`), rather than
   extending `PROTECTED_PREFIXES` to API paths — a middleware redirect would send a `fetch()`
   caller an HTML login page instead of a `401` JSON body, which is worse than the gap it would
   close. **New API routes must call one of these two helpers themselves; the middleware does not
   protect them.**
2. ~~`/lets-play` was missing from `PROTECTED_PREFIXES`~~ **Fixed** — added alongside its sibling
   pages in `app/(app)`.
3. ~~Network-level auth failures leaked raw error text~~ **Fixed.** `authService.login()`/
   `register()` now wrap the Supabase `signIn`/`signUp` calls (`guardNetwork()`) so a fetch-level
   throw (project unreachable, DNS, timeout) surfaces a friendly message instead of the raw
   exception text — reproduced locally as `{"error":"fetch failed"}` before the fix.
4. ~~Admin user listing was mocked~~ **Fixed.** `lib/services/adminService.ts` now calls the
   `admin_list_profiles()` Postgres RPC (`supabase/admin_schema.sql`) instead of returning
   `ADMIN_USER_DIRECTORY`'s 8 fabricated rows. RLS only lets a user read their own `profiles` row,
   so the RPC is `security definer` and checks the caller is actually an admin before returning
   anything — same pattern as the Let's Play RPCs. Every real signed-up user now shows up instead
   of the old fake directory; `scores`/`overallScore` are honestly empty for all of them (see #6
   below — there's no real attempt history yet to aggregate).
5. ~~Dashboard/readiness/Killing Questions ignored who was actually logged in~~ **Fixed.**
   `getExamAttempts()`, `getReadinessReport()`, `getAllWeakestSkills()`, and `getKillingQuestions()`
   always read the fixed `EXAM_ATTEMPTS` demo history (tagged `userId: DEMO_USER.id`) regardless of
   the session — a brand-new user saw the demo account's populated charts on first login. All four
   now take the real session's user ID and filter by it, so only the demo account sees demo data;
   every other user correctly sees a zero/empty state until they take something.
6. **No real exam-attempt persistence.** Finishing a full exam (`app/exam/dsat/page.tsx`'s
   `finishExam()`) doesn't write anywhere — it's a static "Exam Submitted" placeholder. Nothing
   feeds real data into readiness scoring, the dashboard, or the admin directory's per-user scores
   yet; `EXAM_ATTEMPTS` in `lib/mockData.ts` is the only source, and it's fixed demo content.
7. ~~`profiles` RLS allowed self-promotion to admin~~ **Fixed.** The `"Users can update their own
   profile"` policy in `supabase/schema.sql` had no column restriction, so any logged-in user could
   run `supabase.from('profiles').update({role:'admin'}).eq('id', auth.uid())` from the browser
   console and grant themselves admin. Fixed with a `with check` clause that pins `role` to its
   pre-statement value, so a self-update can still change `name`/`avatar_initials`/`target_exams`/
   `target_scores` but is rejected outright if it also tries to change `role`. **This fix lives in
   `supabase/schema.sql` and must be applied by hand to any already-deployed project** — see
   `docs/runbooks/apply-profiles-rls-fix.md`, including how to check for and demote any account
   that already exploited this before the fix was applied.
8. **No automated tests and no CI.** No test runner is configured (`package.json` has no `test`
   script) and there's no `.github/workflows`. Verification today is manual (`npm run lint`,
   `tsc --noEmit`, `npm run build`, and hand-testing) — this is exactly how the gaps above were
   found and how each fix was verified.
9. ~~Smart Studio and Upload Exam leaked every user's data to every other user~~ **Fixed.**
   `smartStudioService.ts` and `uploadedExamService.ts` store uploads in a plain in-memory array
   (Phase 1 has no real file storage/DB — see the `PHASE2` comment above each) but had **no
   `userId` scoping at all**: `getUserTests()`/`getTest()`/`gradeSubmission()`/`getAnswerKey()` and
   `getUploadedExams()`/`getUploadedExam()` all read from the shared array with no ownership check,
   so any authenticated user could list, read, and grade any other user's uploaded test or exam by
   ID (IDs are guessable timestamps: `sst-${Date.now()}-${rand}`). Fixed by adding a `userId` field
   to `SmartStudioTest`/`UploadedExam`, set from the authenticated session at upload time, and
   filtering every getter by it — a request for another user's id now returns the same "not found"
   response as a nonexistent one, so ownership can't be probed via a 403-vs-404 distinction.
10. ~~No rate limiting on any AI-generation endpoint~~ **Fixed.** Every route that calls the
    Anthropic API (`ask-ai`, `exam/dsat`, `exam/ap`, `exam/ielts`, `exam/dsat/adaptive-module`,
    `exam/questions`, `killing-questions`, `smart-studio`, `exam/upload`) now calls
    `requireRateLimit()` (`lib/services/apiAuth.ts`) right after `requireSession()`, backed by an
    in-memory per-user-per-route fixed-window limiter (`lib/services/rateLimiter.ts`). This is
    **best-effort and per-server-instance** — on a multi-instance serverless deployment each
    instance enforces its own independent quota, so the effective limit scales with live instance
    count. Good enough to blunt casual abuse/runaway client loops without adding an external
    dependency; swap for a shared-store limiter (Upstash/Redis) if real abuse is observed. The
    public, unauthenticated `/api/auth/forgot-password` (email-sending) is separately limited by
    IP for the same reason.
11. **Dependency CVEs patched.** `npm audit` found a critical unauthenticated-RCE advisory in
    Next.js (plus bundled `postcss`/`sharp` CVEs) and a high-severity `nanoid` issue. Fixed by
    bumping the pinned `next`/`eslint-config-next` versions from `16.2.11` to `16.3.4` and running
    `npm audit fix`; `npm audit --production` now reports 0 vulnerabilities. Re-run `npm audit`
    periodically — this is a point-in-time fix, not a standing guarantee.

What "end-to-end" did and didn't cover in this pass: without real Supabase/Anthropic credentials,
protected pages correctly redirect to `/login` (verified with placeholder Supabase env vars — an
unreachable project URL makes `getUser()` resolve to "no user" the same way an expired session
would), and non-AI routes (IELTS content, dashboard mock data) render correctly. Post-fix, every
previously-open route now returns `401` under the same conditions, `auth/login` and `auth/register`
remain reachable unauthenticated as intended, and `/lets-play` redirects like its sibling pages.
AI-generation flows (DSAT/AP question generation, Smart Studio, Ask AI) still couldn't be exercised
past confirming they fail gracefully without a key — they need a real `ANTHROPIC_API_KEY` to verify
the actual generated content, timing, and adaptive-difficulty behavior.

## Suggested enhancements

Roughly in priority order:

1. **Add a `.env.example`** listing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `ANTHROPIC_API_KEY` — right now a new contributor has to read source to discover them.
2. **Cache generated questions** — persist a freshly generated DSAT/AP/IELTS set (or Killing
   Questions batch) against its inputs (exam type, domain, difficulty, skill slots) so retries,
   page refreshes, and repeated practice of the same skill don't re-spend a Claude call for
   content that's already been generated.
3. **Add a test suite.** Given the amount of business logic in `lib/services/*` (adaptive
   difficulty, readiness thresholds, Killing Questions targeting, the calculator's expression
   parser) that's independent of the UI, unit tests there would catch regressions cheaply; a
   handful of Playwright smoke tests (login → select exam → answer a question) would cover the
   auth-gated flows end-to-end — and a unit test on `requireSession()`/`requireRateLimit()` usage
   would catch a future route that forgets to call one of them, which is exactly how several of the
   gaps in this file's history happened in the first place.
4. **Basic CI** (`.github/workflows`) running `npm run lint`, `tsc --noEmit`, `npm run build`, and
   `npm audit`, on every PR — none of the fixes in this pass would have needed a manual dev-server
   check or a manually-run `npm audit` to catch if that had existed already.
5. **Move rate limiting to a shared store** (Upstash Redis or similar) once real usage crosses one
   server instance — the current in-memory limiter (`lib/services/rateLimiter.ts`) is per-instance,
   so its effective ceiling scales with live instance count on a multi-instance deployment.
6. **Finish the `PHASE2` items** flagged throughout `lib/services/*` — most notably real
   Supabase-backed persistence for Smart Studio tests and Upload Exam (both currently in-memory,
   reset on every cold start) and swapping `lib/mockData.ts`-backed exam attempts/readiness data
   for live Supabase queries.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Anthropic API Docs](https://docs.claude.com)
