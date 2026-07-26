import { DEMO_USER } from "@/lib/mockData";
import type { UserProfile } from "@/lib/types";
import { simulateLatency } from "./simulateLatency";

// PHASE2: fetch the authenticated user's row from Supabase using the session's user id.
export async function getUserProfile(): Promise<UserProfile> {
  await simulateLatency(150);
  return DEMO_USER;
}
