import { NextResponse } from "next/server";
import { login } from "@/lib/services/authService";
import type { LoginCredentials } from "@/lib/types";

export async function POST(request: Request) {
  let body: Partial<LoginCredentials>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  try {
    const session = await login({ email: body.email, password: body.password });
    return NextResponse.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
