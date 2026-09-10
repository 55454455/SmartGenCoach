import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getAllReadinessReports, getReadinessReport } from "@/lib/services/readinessService";
import { isExamType } from "@/lib/examMeta";

// Scoped per-user by session cookie — never cache (see app/api/dashboard/route.ts for why).
export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE = { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } };

// PHASE2: readiness is computed live by the Orchestrator Agent from full attempt history.
export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType");
  const userId = auth.session.user.id;

  if (!examType) {
    const all = await getAllReadinessReports(userId);
    return NextResponse.json(all, NO_STORE);
  }

  if (!isExamType(examType)) {
    return NextResponse.json({ error: "Invalid examType." }, { status: 400 });
  }

  const report = await getReadinessReport(userId, examType);
  return NextResponse.json(report, NO_STORE);
}
