# Runbook: Apply the profiles self-promotion RLS fix

Applies the updated "Users can update their own profile" policy in `supabase/schema.sql`
to the hosted Supabase project.

**What this fixes:** the `profiles` table's UPDATE policy previously had no `with check`
clause, so any authenticated user could run a client-side `update profiles set role =
'admin' where id = auth.uid()` and grant themselves admin (which unlocks `/admin` and the
`admin_list_profiles()` RPC exposing every user's name/email). The fixed policy still lets
users update their own `name`/`avatar_initials`/`target_exams`/`target_scores`, but rejects
any update that changes `role`.

**Method:** Supabase Dashboard SQL Editor, by hand — same established pattern as
`docs/runbooks/apply-lets-play-schema.md`. There is no Supabase CLI or
`supabase/migrations/` in this repo.

---

## Prerequisites

- An **authenticated Supabase Dashboard session** in your browser.
- **An agent must not enter your credentials.** A human logs in and stays logged in; the
  agent may prepare and hand over SQL but must never type credentials into the dashboard.
- No service-role key or DB password is needed — the Dashboard session authorizes DDL.

---

## Apply

1. Open the SQL Editor for your project (Project → SQL Editor → New query).
2. Paste and run exactly this block (idempotent — safe to run any number of times):

```sql
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select p.role from public.profiles p where p.id = auth.uid()));
```

3. Expect `Success. No rows returned.`

---

## Verification

**1. Policy is attached with a `with check` clause**

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update their own profile';
```

Expected: one row, `with_check` is non-null and references `role`.

**2. Smoke test — a non-role update still works, a role change is rejected**

Run as an authenticated non-admin user (e.g. via the app's Supabase client, not the SQL
Editor's superuser context — the SQL Editor bypasses RLS, so this check must be run through
`supabase-js` with a real user session, not pasted directly here). From the app or a quick
script:

```js
// Should succeed:
await supabase.from("profiles").update({ name: "New Name" }).eq("id", user.id);

// Should fail (0 rows affected, no error thrown by default — check the returned data/count):
const { data } = await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id).select();
// data should be [] — the row was not updated because with_check rejected it.
```

---

## Already-escalated accounts

This fix only stops *future* self-promotion. If a user already exploited this to set their
own `role` to `'admin'` before this fix was applied, check for and correct that manually:

```sql
select id, email, role from public.profiles where role = 'admin';
```

Review the list and demote any account that shouldn't be there:

```sql
update public.profiles set role = 'user' where id = '<uuid-of-account-to-demote>';
```

(This direct `update` from the SQL Editor bypasses RLS since it runs with the Editor's
elevated context, so it works even under the new policy.)

---

## Done

Sign in as a non-admin test user and confirm `/admin` still redirects away, and that the
account's profile fields (if a settings/profile-edit UI exists) can still be updated.
