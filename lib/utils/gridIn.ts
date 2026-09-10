import type { Question } from "@/lib/types";

// Parses a grid-in entry (plain integer/decimal, or a simple "n/d" fraction) into a number so
// differently-formatted-but-equivalent answers ("3/4", "0.75", ".75") compare equal. Returns null
// for anything unparseable, which never matches — an empty/garbled entry is just marked wrong.
export function parseGridInValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fractionMatch = /^-?\d+\/\d+$/.exec(trimmed);
  if (fractionMatch) {
    const [numerator, denominator] = trimmed.split("/").map(Number);
    if (denominator === 0) return null;
    return numerator / denominator;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

const GRID_IN_TOLERANCE = 1e-9;

function isGridInCorrect(question: Question, rawAnswer: string | undefined): boolean {
  if (!rawAnswer) return false;
  const given = parseGridInValue(rawAnswer);
  if (given === null) return false;
  return (question.acceptedAnswers ?? []).some((accepted) => {
    const acceptedValue = parseGridInValue(accepted);
    return acceptedValue !== null && Math.abs(acceptedValue - given) < GRID_IN_TOLERANCE;
  });
}

/** Format-aware correctness check — grid-in compares numeric value, multiple-choice compares the
 *  selected choice id. `answer` is whatever's stored for this question in the exam store: a
 *  choiceId for multiple-choice, raw typed text for grid-in. */
export function isAnswerCorrect(question: Question, answer: string | undefined): boolean {
  if (!answer) return false;
  return question.format === "grid-in" ? isGridInCorrect(question, answer) : answer === question.correctChoiceId;
}
