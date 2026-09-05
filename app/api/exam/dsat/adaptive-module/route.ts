import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getAdaptiveDsatModule2 } from "@/lib/services/examService";

// Real Claude call (thinking + up to 3 retries) generating Module 2's questions on the fly, once
// the student's Module 1 performance in this domain is known — give it the same room as the other
// generation routes so it isn't killed mid-request by the platform's default serverless timeout.
export const maxDuration = 60;

interface AdaptiveModuleRequestBody {
  domain?: "Math" | "Reading and Writing";
  correctCount?: number;
  total?: number;
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const body = (await request.json()) as AdaptiveModuleRequestBody;
  if (body.domain !== "Math" && body.domain !== "Reading and Writing") {
    return NextResponse.json({ error: "domain must be \"Math\" or \"Reading and Writing\"." }, { status: 400 });
  }
  if (typeof body.correctCount !== "number" || typeof body.total !== "number" || body.total <= 0) {
    return NextResponse.json({ error: "correctCount and total are required." }, { status: 400 });
  }

  try {
    const result = await getAdaptiveDsatModule2({
      domain: body.domain,
      correctCount: body.correctCount,
      total: body.total,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate the next module.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
