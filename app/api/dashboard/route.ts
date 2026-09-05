import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getExamAttempts } from "@/lib/services/examService";
import { getAllReadinessReports } from "@/lib/services/readinessService";
import { getAllWeakestSkills } from "@/lib/services/skillService";

// PHASE2: this aggregation becomes an Orchestrator Agent call that merges live Supabase data
// with each sub-agent's latest assessment.
export async function GET() {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const [readiness, attempts, weakestSkills] = await Promise.all([
    getAllReadinessReports(),
    getExamAttempts(),
    getAllWeakestSkills(6),
  ]);
  return NextResponse.json({ readiness, attempts, weakestSkills });
}
