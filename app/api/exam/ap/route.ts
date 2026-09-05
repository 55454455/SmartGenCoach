import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getApExamBundle } from "@/lib/services/examService";

// Each subject module is a real Claude call (thinking + up to 3 retries) — give it room to finish
// instead of getting killed by the platform's default serverless timeout.
export const maxDuration = 60;

export async function GET() {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  try {
    const bundle = await getApExamBundle();
    return NextResponse.json(bundle);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate this exam.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
