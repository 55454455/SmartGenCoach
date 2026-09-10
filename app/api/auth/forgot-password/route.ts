import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/services/authService";
import { checkRateLimit } from "@/lib/services/rateLimiter";

// Deliberately public (no requireSession) — the whole point is a logged-out user requesting a
// reset link, same category as /api/auth/login and /api/auth/register. Being public and
// email-sending makes it a classic abuse target (spam a stranger's inbox with reset links), so
// it's rate-limited by IP rather than by user id like the authenticated routes.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const redirectTo = `${new URL(request.url).origin}/reset-password`;
  try {
    await requestPasswordReset(body.email, redirectTo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send the reset email.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
