import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { resetPassword } from "@/lib/services/authService";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.password || body.password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  try {
    await resetPassword(body.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reset your password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
