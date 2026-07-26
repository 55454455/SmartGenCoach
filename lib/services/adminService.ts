import { ADMIN_USER_DIRECTORY } from "@/lib/mockData";
import type { AdminUserRow } from "@/lib/types";
import { simulateLatency } from "./simulateLatency";

// PHASE2: replace with a Supabase query joining `profiles` and aggregated `readiness_reports`,
// scoped by an admin-only RLS policy — the AdminUserRow shape stays the same.
export async function getAllUsers(): Promise<AdminUserRow[]> {
  await simulateLatency(300);
  return ADMIN_USER_DIRECTORY;
}
