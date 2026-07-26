// Shared defensive check used across the AI generation/extraction services
// (Killing Questions, Smart Studio, Upload Exam). Forced tool_choice gives the
// model a single JSON output surface, so on hard problems it can occasionally
// spill visible scratch-work / self-correction into a string field even when
// adaptive thinking is enabled and the prompt explicitly forbids it. Rather
// than trust prompting alone, we scan generated text for tell-tale phrases
// and treat a hit as an invalid response so the caller can retry.
const LEAK_PATTERNS: RegExp[] = [
  /\bwait[,.]/i,
  /\bwait —/i,
  /\bwait -/i,
  /\blet me (re-?examine|re-?check|recheck|reconsider|verify|double-?check)/i,
  /\blet'?s (verify|re-?examine|recheck|double-?check|check)/i,
  /\bre-?checking\b/i,
  /\bdouble-?check(ing)?\b/i,
  /\bactually,? (the|it|wait|no|let)/i,
  /\bon second thought\b/i,
  /\bhold on\b/i,
  /\bhmm+\b/i,
  /\bscratch that\b/i,
  /\.\.\.\s*(wait|actually|let me|hmm)/i,
  /\bi (was|made) (wrong|a mistake|an error)\b/i,
  /\bcorrecting myself\b/i,
];

export function containsReasoningLeak(text: string | undefined | null): boolean {
  if (!text) return false;
  return LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

export function questionHasReasoningLeak(question: {
  prompt?: string | null;
  passage?: string | null;
  explanation?: string | null;
  choices?: { text?: string | null }[];
}): boolean {
  if (containsReasoningLeak(question.prompt) || containsReasoningLeak(question.passage) || containsReasoningLeak(question.explanation)) {
    return true;
  }
  return (question.choices ?? []).some((choice) => containsReasoningLeak(choice.text));
}
