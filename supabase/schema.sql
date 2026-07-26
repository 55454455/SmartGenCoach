-- Run this once in the Supabase Dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Mirrors lib/types.ts UserProfile. One row per auth.users row, created automatically on signup.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  avatar_initials text not null,
  target_exams text[] not null default '{}',
  target_scores jsonb not null default '{}',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-creates a profiles row whenever someone signs up via supabase.auth.signUp().
-- "name" is read from the signUp options.data payload (see lib/services/authService.ts).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  full_name text := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
  initials text := upper(
    substr(split_part(full_name, ' ', 1), 1, 1) ||
    coalesce(substr(split_part(full_name, ' ', 2), 1, 1), '')
  );
begin
  insert into public.profiles (id, name, email, avatar_initials, target_exams, target_scores, role)
  values (new.id, full_name, new.email, initials, '{}', '{}', 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
