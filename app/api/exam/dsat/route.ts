import { NextResponse } from "next/server";
import { getDsatExamBundle } from "@/lib/services/examService";

// Module 1 for both domains is a real Claude call (thinking + up to 3 retries) — give it room to
// finish instead of getting killed by the platform's default serverless timeout.
export const maxDuration = 60;

export async function GET() {
  try {
    const bundle = await getDsatExamBundle();
    return NextResponse.json(bundle);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate this exam.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
