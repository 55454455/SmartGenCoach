import { NextResponse } from "next/server";
import { getApExamBundle } from "@/lib/services/examService";

// PHASE2: replace with an Orchestrator Agent call that assembles an adaptive module set per student.
export async function GET() {
  const bundle = await getApExamBundle();
  return NextResponse.json(bundle);
}
