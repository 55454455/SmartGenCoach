import Anthropic from "@anthropic-ai/sdk";

// PHASE2: once this moves behind a real Multi-Agent orchestration layer, these mappings should
// feed structured telemetry too — for now they exist purely to keep raw Anthropic API error JSON
// (status codes, internal error types, request IDs) from ever reaching the end user, while still
// telling call sites whether the failure is worth retrying.
export interface AnthropicErrorInfo {
  message: string;
  retryable: boolean;
}

// Wrap every `anthropic.messages.create()` call site with this so a thrown SDK/API error (bad
// image, rate limit, overloaded service, network abort, etc.) never leaks its raw `err.message`
// (which can look like `400 {"type":"error","error":{...}}`) straight through to the client.
export function describeAnthropicError(err: unknown): AnthropicErrorInfo {
  // Server-side only — full detail for our own logs/observability, never sent to the client.
  console.error("[anthropic] call failed:", err);
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    switch (status) {
      case 400:
        return {
          message: "The AI couldn't read that file. Try a clearer scan/photo, a different format, or a smaller file.",
          retryable: false,
        };
      case 401:
      case 403:
        return { message: "The AI service rejected the request. Please try again in a moment.", retryable: false };
      case 404:
        return { message: "The AI service is temporarily misconfigured. Please try again later.", retryable: false };
      case 413:
        return { message: "That file is too large for the AI to process — try a smaller file.", retryable: false };
      case 429:
        return { message: "The AI service is busy right now.", retryable: true };
      default:
        if (typeof status === "number" && status >= 500) {
          return { message: "The AI service is temporarily overloaded.", retryable: true };
        }
        return { message: "The AI service returned an unexpected error.", retryable: true };
    }
  }
  if (err instanceof Error && (err.name === "AbortError" || /timed? ?out/i.test(err.message))) {
    return { message: "That request took too long and timed out.", retryable: true };
  }
  return { message: "Something went wrong talking to the AI. Please try again.", retryable: true };
}
