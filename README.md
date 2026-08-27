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
- **Auth boundary**: `proxy.ts` → `lib/supabase/middleware.ts` is intended to be the real
  server-side gate (see the comment in `components/layout/AuthGuard.tsx`); `AuthGuard` is a
  client-side confirmation layer on top of it, not a replacement. See
  [Known limitations](#known-limitations) — this boundary currently has real gaps.
  Its `PROTECTED_PREFIXES` list matches on the request pathname, which is a routing detail worth
  double-checking whenever a new top-level route is added.
- **Services layer** (`lib/services/*`): all data access and Claude calls are isolated here behind
  plain async functions, decoupled from the mock data in `lib/mockData.ts`. Look for `PHASE2`
  comments — they mark exactly where a function currently returns mock/static data and what the
  real Supabase-backed replacement should look like.
- **Generated-question caching**: none yet — every exam/practice/killing-questions load is a fresh
  Claude call. Fine for a demo, costly at any real traffic volume.

## Known limitations

Found while exercising the app end-to-end (dev server, real HTTP requests, no live Supabase/Anthropic
credentials — see below for what that does and doesn't cover):

1. **Most API routes have no server-side auth check.** `proxy.ts`'s `PROTECTED_PREFIXES` list
   (`lib/supabase/middleware.ts`) only ever matches page paths like `/dashboard` or
   `/killing-questions` — no entry starts with `/api`, so it never matches an API route's actual
   path (`/api/dashboard`, `/api/killing-questions`, etc.), even though the middleware's matcher
   does run on `/api/*`. Of the 19 route handlers under `app/api/`, only `admin/users` and
   `auth/session` call `getCurrentSession()` themselves. Confirmed by curling
   `/api/dashboard`, `/api/killing-questions?examType=DSAT`, `/api/exam/dsat`, and others directly
   with no session cookie — all returned real data (or a real Claude-call attempt) instead of a
   403. This means every Claude-backed endpoint (`ask-ai`, `killing-questions`, `exam/ap`,
   `exam/dsat`, `exam/dsat/adaptive-module`, `exam/ielts`, `exam/questions`, `exam/upload*`,
   `smart-studio*`) is publicly callable and billable by anyone with the URL, logged in or not.
2. **`/lets-play` is missing from `PROTECTED_PREFIXES`.** Every other page under `app/(app)` is
   listed; this one isn't, so it's the one page in that group actually reachable pre-redirect,
   contradicting the "proxy.ts is the real boundary" comment in `AuthGuard.tsx`. `AuthGuard`'s
   client-side check still catches it after the fact, but only after the page has loaded once.
3. **Network-level auth failures leak raw error text.** `authService.register()` calls
   `supabase.auth.signUp()` without a try/catch around the fetch itself; when that fetch throws
   (as opposed to `supabase` returning an `{ error }` object), the route handler's catch-all
   forwards `err.message` verbatim — reproduced locally as `{"error":"fetch failed"}`. `login()`
   has the same shape of exposure. Contrast with the AI routes, which all normalize failures to a
   friendly "Something went wrong talking to the AI" message.
4. **Admin user listing is mocked** (`lib/services/adminService.ts`, tagged `PHASE2`) — returns
   `ADMIN_USER_DIRECTORY` from `lib/mockData.ts` regardless of what's actually in Supabase. The
   admin role check on top of it (`app/api/admin/users/route.ts`) is real.
5. **No automated tests and no CI.** No test runner is configured (`package.json` has no `test`
   script) and there's no `.github/workflows`. Verification today is manual (`npm run lint`,
   `tsc --noEmit`, `npm run build`, and hand-testing).

What "end-to-end" did and didn't cover in this pass: without real Supabase/Anthropic credentials,
protected pages correctly redirect to `/login` (verified with placeholder Supabase env vars — an
unreachable project URL makes `getUser()` resolve to "no user" the same way an expired session
would), and non-AI routes (IELTS content, dashboard mock data) render correctly. AI-generation
flows (DSAT/AP question generation, Smart Studio, Ask AI) could not be exercised past confirming
they fail gracefully without a key — they need a real `ANTHROPIC_API_KEY` to verify the actual
generated content, timing, and adaptive-difficulty behavior.

## Suggested enhancements

Roughly in priority order:

1. **Close the API auth gap** (#1 above). Either extend `PROTECTED_PREFIXES` to cover API paths, or
   — more robust against future routes being added and forgotten — flip the model: make
   `getCurrentSession()` (or a thin wrapper) the default for every route under `app/api/`, and
   opt specific routes *out* rather than in. Also add `/lets-play` to the page-level list.
2. **Add a `.env.example`** listing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `ANTHROPIC_API_KEY` — right now a new contributor has to read source to discover them.
3. **Rate-limit or budget-cap the Claude-backed endpoints** once #1 is fixed and this goes anywhere
   near production traffic — even authenticated users could otherwise reload a full-exam page in a
   loop and generate an unbounded number of paid API calls.
4. **Wrap Supabase network calls in `authService`** (and any other service that calls Supabase
   directly) so a transient outage surfaces the same kind of friendly message the AI routes already
   give, instead of raw fetch errors.
5. **Cache generated questions** — persist a freshly generated DSAT/AP/IELTS set (or Killing
   Questions batch) against its inputs (exam type, domain, difficulty, skill slots) so retries,
   page refreshes, and repeated practice of the same skill don't re-spend a Claude call for
   content that's already been generated.
6. **Add a test suite.** Given the amount of business logic in `lib/services/*` (adaptive
   difficulty, readiness thresholds, Killing Questions targeting, the calculator's expression
   parser) that's independent of the UI, unit tests there would catch regressions cheaply; a
   handful of Playwright smoke tests (login → select exam → answer a question) would cover the
   auth-gated flows end-to-end.
7. **Basic CI** (`.github/workflows`) running `npm run lint`, `tsc --noEmit`, and `npm run build`
   on every PR — none of the fixes in this pass would have needed a manual dev-server check to
   catch if that had existed already.
8. **Finish the `PHASE2` items** flagged throughout `lib/services/*` — most notably real
   Supabase-backed admin user listing (`adminService.ts`) and swapping `lib/mockData.ts`-backed
   exam attempts/readiness data for live Supabase queries.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Anthropic API Docs](https://docs.claude.com)
