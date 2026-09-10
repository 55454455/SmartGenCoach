import { NextResponse } from "next/server";
import { register } from "@/lib/services/authService";
import type { RegisterInput } from "@/lib/types";

export async function POST(request: Request) {
  let body: Partial<RegisterInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
  }
  try {
    const session = await register({ name: body.name, email: body.email, password: body.password });
    return NextResponse.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
