import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getIeltsListeningBundle, getIeltsSpeakingPrompts, getQuestionsByDomain } from "@/lib/services/examService";
import type { IeltsDomain } from "@/lib/types";

const VALID_SECTIONS: IeltsDomain[] = ["Listening", "Reading", "Writing", "Speaking"];

function isIeltsDomain(value: string): value is IeltsDomain {
  return (VALID_SECTIONS as string[]).includes(value);
}

// PHASE2: Listening audio + Speaking prompts are generated per-student by the relevant agent.
// Reading/Writing questions are already a real Claude call (thinking + up to 3 retries) — give the
// route room to finish instead of getting killed by the platform's default serverless timeout.
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") ?? "Listening";

  if (!isIeltsDomain(section)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }

  try {
    if (section === "Listening") {
      const bundle = await getIeltsListeningBundle();
      return NextResponse.json({ section, ...bundle });
    }

    if (section === "Speaking") {
      const prompts = await getIeltsSpeakingPrompts();
      return NextResponse.json({ section, prompts });
    }

    const questions = await getQuestionsByDomain("IELTS", section);
    return NextResponse.json({ section, questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate this section.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
