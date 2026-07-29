# Runbook: Apply the "Let's Play" schema

Applies `supabase/lets_play_schema.sql` to the hosted Supabase project.

**What this backs:** the real-time multiplayer trivia feature at route `/lets-play`
(`app/(app)/lets-play/page.tsx`, `app/(app)/lets-play/[code]/page.tsx`) driven by
`lib/services/letsPlayService.ts`.

**Method:** Supabase Dashboard SQL Editor, by hand. This is the project's established
pattern — `supabase/schema.sql` was applied the same way and there is no Supabase CLI,
`config.toml`, or `supabase/migrations/` in this repo.

---

## Prerequisites

- An **authenticated Supabase Dashboard session** in your browser, with access to project
  `hndepitajywkgdtltfor`.
- **An agent must not enter your credentials.** If you are delegating this, a human logs in
  and stays logged in; the agent may prepare and hand over SQL but must never type an email,
  password, or MFA code into the dashboard.
- No service-role key or DB password is needed for this procedure. The anon key in
  `.env.local` is *not* sufficient to run DDL — the Dashboard session is what authorizes it.

---

## Apply

1. Open the SQL Editor directly:
   <https://supabase.com/dashboard/project/hndepitajywkgdtltfor/sql/new>
2. Open `supabase/lets_play_schema.sql` from the repo and copy the **entire** file (187 lines).
3. Paste it into the editor.
4. Click **Run** (or Cmd/Ctrl+Enter).
5. Expect `Success. No rows returned.` Any error means nothing after that point ran — fix and
   re-read the idempotency section below before retrying.

---

## Idempotency — read before re-running

Most of this script is safe to run twice, but **not all of it**:

| Part | Guard | Re-runnable? |
|---|---|---|
| 3 × `create table` | `if not exists` | Yes |
| 5 × policies | `drop policy if exists` before each `create policy` | Yes |
| 3 × functions | `create or replace function` | Yes |
| **3 × `alter publication supabase_realtime add table ...`** | **none** | **No** |

The last three lines are bare `alter publication` statements. On a second run they fail with:

```
ERROR: relation "lets_play_rooms" is already member of publication "supabase_realtime"
```

That is the *only* thing that blocks a re-run. The tables are fine.

**If you need to re-run the script**, delete the final three `alter publication` lines from
what you paste, then run this guarded block separately (safe any number of times):

```sql
do $$
declare
  t text;
begin
  foreach t in array array['lets_play_rooms', 'lets_play_players', 'lets_play_answers']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
```

---

## Verification checklist

Click through the Dashboard and confirm all four:

- [ ] **Table Editor** — 3 tables in `public`: `lets_play_rooms`, `lets_play_players`,
      `lets_play_answers`.
- [ ] **Database → Functions** — 3 functions: `lets_play_advance_question`,
      `lets_play_set_room_status`, `lets_play_submit_answer`.
- [ ] **Database → Replication** — under the `supabase_realtime` publication, **all three
      tables are enabled**. ⚠️ This one is required. If a table is missing here, nothing errors
      and nothing looks broken — the app just silently never receives row changes for it, so
      the lobby roster / live answers / room state stop syncing between players.
- [ ] **Authentication → Policies** (or Table Editor → RLS) — RLS enabled on all 3 tables, with
      5 policies total: 2 on `lets_play_rooms` (select + insert), 2 on `lets_play_players`
      (select + insert), 1 on `lets_play_answers` (select only).

> `lets_play_answers` having **no** insert policy is intentional, not a mistake. Clients must
> go through `lets_play_submit_answer` (security definer) so the first-correct-answer scoring
> lock can't be bypassed. Likewise there are no UPDATE policies anywhere — all state
> transitions go through the RPCs.

---

## Smoke test

Run these in the SQL Editor after applying. All four should pass.

**1. Tables exist and are empty**

```sql
select 'lets_play_rooms'   as table_name, count(*) as row_count from public.lets_play_rooms
union all
select 'lets_play_players', count(*) from public.lets_play_players
union all
select 'lets_play_answers', count(*) from public.lets_play_answers;
```

Expected: 3 rows, `row_count` = `0` for each. An `ERROR: relation ... does not exist` means the
table was never created.

**2. Realtime publication membership — the failure mode that is otherwise silent**

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename like 'lets_play_%'
order by tablename;
```

Expected: exactly 3 rows — `lets_play_answers`, `lets_play_players`, `lets_play_rooms`.
Fewer than 3 → run the guarded `do $$` block above.

**3. All three RPCs exist and are security definer**

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'lets_play_advance_question',
    'lets_play_set_room_status',
    'lets_play_submit_answer'
  )
order by p.proname;
```

Expected: 3 rows, `security_definer` = `true` on all three. Signatures:

| proname | args |
|---|---|
| `lets_play_advance_question` | `p_room_id uuid, p_question_index integer, p_question_id text` |
| `lets_play_set_room_status` | `p_room_id uuid, p_status text` |
| `lets_play_submit_answer` | `p_room_id uuid, p_question_id text, p_choice_id text, p_is_correct boolean` |

`security_definer = false` means the RPC will run with the caller's RLS and the scoring lock
will fail — re-run the function definitions.

**4. RLS is on and policies are attached**

```sql
select c.relname               as table_name,
       c.relrowsecurity        as rls_enabled,
       count(pol.polname)      as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy pol on pol.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in ('lets_play_rooms', 'lets_play_players', 'lets_play_answers')
group by c.relname, c.relrowsecurity
order by c.relname;
```

Expected:

| table_name | rls_enabled | policy_count |
|---|---|---|
| `lets_play_answers` | `true` | 1 |
| `lets_play_players` | `true` | 2 |
| `lets_play_rooms` | `true` | 2 |

To see the policies by name:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename like 'lets_play_%'
order by tablename, policyname;
```

---

## Done

Sign in to the app and open `/lets-play`. Create a room in one browser and join it by code in a
second (different user). If the roster in the host's lobby updates without a refresh, Realtime
is wired up correctly.
