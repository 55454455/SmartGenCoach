// Client-safe constants for the Ask AI feature. This file must never import the Anthropic SDK
// or anything else that reads server-only env vars — it's imported directly by a "use client"
// component (AskAiWidget), and Next.js bundles whatever a client component imports into the
// browser. Keeping askAiService.ts (which instantiates `new Anthropic(...)`) out of that import
// graph is what prevents the SDK's module-scope client from being constructed in the browser.
export const ASK_AI_AGENT_NAME = "Nova";
