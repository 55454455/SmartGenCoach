import { NextResponse } from "next/server";
import { requireRateLimit, requireSession } from "@/lib/services/apiAuth";
import { getKillingQuestions } from "@/lib/services/killingQuestionsService";
import { isExamType } from "@/lib/examMeta";

// Question generation is a real Claude call (with thinking + up to 3 retries) — give it room to
// finish instead of getting killed by the platform's default serverless timeout.
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType") ?? "DSAT";

  if (!isExamType(examType)) {
    return NextResponse.json({ error: "Invalid examType." }, { status: 400 });
  }

  const limited = requireRateLimit(auth.session.user.id, "killing-questions", 10, 10 * 60 * 1000);
  if (limited) return limited;

  try {
    const result = await getKillingQuestions(examType, auth.session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate targeted practice questions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
