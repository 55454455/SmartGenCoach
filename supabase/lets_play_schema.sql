-- Run this once in the Supabase Dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Backs the "Let's Play" real-time multiplayer trivia feature (components/exam + lib/services/letsPlayService.ts).
--
-- Design notes:
-- - Rooms store the full generated Question[] as jsonb (`questions`). This mirrors how every other
--   exam mode already ships correctChoiceId to the client up front (see lib/services/examService.ts) —
--   there is no server-authoritative anti-cheat anywhere else in this app, so Let's Play doesn't
--   invent one either.
-- - The host's browser is the sole timer authority (there is no standalone game server). The host
--   calls lets_play_advance_question / lets_play_set_room_status; every other client just reacts to
--   the resulting Postgres row change over Realtime. This is intentional and matches "the project's
--   existing real-time backend" (Supabase Realtime), not a custom WebSocket server.
-- - The race for "first correct answer wins the point" is resolved with a single atomic UPDATE ...
--   WHERE current_question_winner IS NULL inside lets_play_submit_answer. Postgres serializes
--   concurrent UPDATEs to the same row, so exactly one caller can ever observe row_count > 0 for a
--   given question — this is what makes the scoring lock race-condition-safe, not client-side timing.

create table if not exists public.lets_play_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  exam_type text not null,
  domain text not null,
  questions jsonb not null default '[]',
  status text not null default 'lobby' check (status in ('lobby', 'active', 'reveal', 'finished')),
  current_question_index integer not null default 0,
  current_question_id text,
  current_question_winner uuid references auth.users (id),
  current_question_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lets_play_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.lets_play_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  avatar_initials text not null,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.lets_play_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.lets_play_rooms (id) on delete cascade,
  question_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  choice_id text not null,
  is_correct boolean not null,
  points integer not null default 0,
  answered_at timestamptz not null default now(),
  unique (room_id, question_id, user_id)
);

alter table public.lets_play_rooms enable row level security;
alter table public.lets_play_players enable row level security;
alter table public.lets_play_answers enable row level security;

-- Rooms: anyone signed in can look a room up by code / read live state; only the host can create one
-- (direct row updates are blocked — all state transitions go through the security-definer RPCs below).
drop policy if exists "Authenticated users can read rooms" on public.lets_play_rooms;
create policy "Authenticated users can read rooms"
  on public.lets_play_rooms for select
  using (auth.role() = 'authenticated');

drop policy if exists "Host can create their own room" on public.lets_play_rooms;
create policy "Host can create their own room"
  on public.lets_play_rooms for insert
  with check (auth.uid() = host_id);

-- Players: anyone signed in can see the roster; a player can only ever insert their own row (score
-- updates happen only via lets_play_submit_answer, which runs as security definer).
drop policy if exists "Authenticated users can read players" on public.lets_play_players;
create policy "Authenticated users can read players"
  on public.lets_play_players for select
  using (auth.role() = 'authenticated');

drop policy if exists "Players can join as themselves" on public.lets_play_players;
create policy "Players can join as themselves"
  on public.lets_play_players for insert
  with check (auth.uid() = user_id);

-- Answers: anyone signed in can read the live answer feed; direct inserts are blocked (client always
-- goes through lets_play_submit_answer so the scoring lock can't be bypassed).
drop policy if exists "Authenticated users can read answers" on public.lets_play_answers;
create policy "Authenticated users can read answers"
  on public.lets_play_answers for select
  using (auth.role() = 'authenticated');

-- Host-only room state transitions: starts the game / advances to question N / moves into reveal.
-- Always stamps current_question_started_at so every client (not just the host) can render an
-- accurate synced countdown from a shared server timestamp.
create or replace function public.lets_play_advance_question(
  p_room_id uuid,
  p_question_index integer,
  p_question_id text
) returns void as $$
begin
  update public.lets_play_rooms
  set current_question_index = p_question_index,
      current_question_id = p_question_id,
      current_question_winner = null,
      current_question_started_at = now(),
      status = 'active'
  where id = p_room_id and host_id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

-- Host-only generic status transition (used for 'reveal' and 'finished').
create or replace function public.lets_play_set_room_status(
  p_room_id uuid,
  p_status text
) returns void as $$
begin
  if p_status not in ('lobby', 'active', 'reveal', 'finished') then
    raise exception 'Invalid status: %', p_status;
  end if;
  update public.lets_play_rooms
  set status = p_status
  where id = p_room_id and host_id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

-- The race-condition-safe scoring lock: first caller to land a correct answer on the *current*
-- question claims current_question_winner and the point; every later caller (correct or not) gets 0.
create or replace function public.lets_play_submit_answer(
  p_room_id uuid,
  p_question_id text,
  p_choice_id text,
  p_is_correct boolean
) returns table(points integer, is_first boolean) as $$
declare
  v_uid uuid := auth.uid();
  v_row_count integer;
  v_points integer := 0;
  v_is_first boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.lets_play_answers (room_id, question_id, user_id, choice_id, is_correct)
  values (p_room_id, p_question_id, v_uid, p_choice_id, p_is_correct)
  on conflict (room_id, question_id, user_id) do nothing;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    -- Already answered this question — return their previously recorded result instead of 0/false
    -- so a duplicate call (e.g. a retried request) doesn't look like a fresh miss.
    return query
      select a.points, (a.points > 0)
      from public.lets_play_answers a
      where a.room_id = p_room_id and a.question_id = p_question_id and a.user_id = v_uid;
    return;
  end if;

  if p_is_correct then
    -- Atomic claim: only the first concurrent caller observes current_question_winner IS NULL.
    update public.lets_play_rooms
    set current_question_winner = v_uid
    where id = p_room_id
      and current_question_id = p_question_id
      and current_question_winner is null;

    get diagnostics v_row_count = row_count;
    if v_row_count > 0 then
      v_points := 1;
      v_is_first := true;
      update public.lets_play_players
      set score = score + 1
      where room_id = p_room_id and user_id = v_uid;
    end if;
  end if;

  update public.lets_play_answers
  set points = v_points
  where room_id = p_room_id and question_id = p_question_id and user_id = v_uid;

  return query select v_points, v_is_first;
end;
$$ language plpgsql security definer set search_path = public;

-- Push row changes to every subscribed client (lobby roster, live answers feed, room state).
alter publication supabase_realtime add table public.lets_play_rooms;
alter publication supabase_realtime add table public.lets_play_players;
alter publication supabase_realtime add table public.lets_play_answers;
