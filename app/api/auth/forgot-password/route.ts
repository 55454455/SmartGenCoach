import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/services/authService";

// Deliberately public (no requireSession) — the whole point is a logged-out user requesting a
// reset link, same category as /api/auth/login and /api/auth/register.
export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
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
