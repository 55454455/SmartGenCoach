import { NextResponse } from "next/server";
import { getCurrentSession } from "./authService";
import type { AuthSession } from "@/lib/types";

// Every route handler under app/api/ must call one of these before doing any real work.
// proxy.ts's PROTECTED_PREFIXES only gates page navigations, not API calls — a route that
// forgets this check is reachable by anyone, logged in or not.
type AuthGuardResult = { session: AuthSession; response?: never } | { session?: never; response: NextResponse };

export async function requireSession(): Promise<AuthGuardResult> {
  const session = await getCurrentSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdminSession(): Promise<AuthGuardResult> {
  const auth = await requireSession();
  if (auth.response) return auth;
  if (auth.session.user.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}
