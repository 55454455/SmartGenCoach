import { NextResponse } from "next/server";
import { getIeltsListeningBundle, getIeltsSpeakingPrompts, getQuestionsByDomain } from "@/lib/services/examService";
import type { IeltsDomain } from "@/lib/types";

const VALID_SECTIONS: IeltsDomain[] = ["Listening", "Reading", "Writing", "Speaking"];

function isIeltsDomain(value: string): value is IeltsDomain {
  return (VALID_SECTIONS as string[]).includes(value);
}

// PHASE2: Listening audio + Speaking prompts are generated per-student by the relevant agent.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") ?? "Listening";

  if (!isIeltsDomain(section)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }

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
}
