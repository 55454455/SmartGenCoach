import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getExamAttempts } from "@/lib/services/examService";
import { getAllReadinessReports } from "@/lib/services/readinessService";
import { getAllWeakestSkills } from "@/lib/services/skillService";

// Every response here is scoped to whichever user's session cookie made the request — never cache
// it at any layer (CDN, Next's data cache, the browser), or one user's private scores could be
// served back to a different user entirely.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// PHASE2: this aggregation becomes an Orchestrator Agent call that merges live Supabase data
// with each sub-agent's latest assessment.
export async function GET() {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const userId = auth.session.user.id;
  const [readiness, attempts, weakestSkills] = await Promise.all([
    getAllReadinessReports(userId),
    getExamAttempts(userId),
    getAllWeakestSkills(userId, 6),
  ]);
  return NextResponse.json(
    { readiness, attempts, weakestSkills },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
