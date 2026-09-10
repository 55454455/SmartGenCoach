-- Run this once in the Supabase Dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Backs the real (non-mock) admin user directory (lib/services/adminService.ts).
--
-- RLS on public.profiles only lets a user read their own row ("auth.uid() = id" — see schema.sql),
-- so listing every user for the admin dashboard needs an explicit, gated escape hatch rather than a
-- wider SELECT policy. This security-definer function checks the caller is actually an admin before
-- returning anything — the same pattern already used for the Let's Play RPCs in lets_play_schema.sql.
create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  name text,
  email text,
  created_at timestamptz,
  role text
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
    select p.id, p.name, p.email, p.created_at, p.role
    from public.profiles p
    order by p.created_at asc;
end;
$$;
