import { NextResponse } from "next/server";
import { getCurrentSession } from "./authService";
import { checkRateLimit } from "./rateLimiter";
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

// Every route that calls the Anthropic API must also call this, right after requireSession(), to
// keep one user from running up API costs or exhausting the shared Anthropic quota. `routeKey`
// scopes the bucket to that specific endpoint so a burst on one route doesn't consume another's
// budget. See lib/services/rateLimiter.ts for the (best-effort, per-instance) limiter itself.
export function requireRateLimit(
  userId: string,
  routeKey: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const result = checkRateLimit(`${routeKey}:${userId}`, limit, windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment before trying again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
