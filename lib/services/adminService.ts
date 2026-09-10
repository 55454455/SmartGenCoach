import { createClient } from "@/lib/supabase/server";
import type { AdminUserRow } from "@/lib/types";

interface AdminProfileRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
  role: string;
}

// Real Supabase-backed listing via the admin_list_profiles() RPC (supabase/admin_schema.sql) — RLS
// only lets a user read their own profiles row, so this goes through a security-definer function
// that checks the caller is actually an admin, rather than the mock ADMIN_USER_DIRECTORY this used
// to return regardless of who was actually signed up.
//
// PHASE2: `scores`/`overallScore` are honestly empty for every real user — there's no real exam
// attempt history persisted anywhere yet (see the PHASE2 note on getExamAttempts in examService.ts),
// so there's nothing genuine to aggregate. Wire these up once attempts are actually saved.
export async function getAllUsers(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_profiles");
  if (error) {
    throw new Error("Could not load the user directory.");
  }
  return (data as AdminProfileRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    scores: {},
    overallScore: 0,
  }));
}
