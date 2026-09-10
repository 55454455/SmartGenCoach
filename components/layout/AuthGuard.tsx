"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { Spinner } from "@/components/ui/Spinner";
import type { AuthSession } from "@/lib/types";

// The actual security boundary is proxy.ts, which redirects unauthenticated requests
// before this component ever renders. This guard just keeps the cached profile (name, role,
// avatar) in sync with the real Supabase session — the cache can be empty even when the user
// is genuinely logged in (new tab, cleared localStorage, different device), so it confirms
// with the server via /api/auth/session instead of trusting the local cache alone.
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasHydrated || session) return;
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? (res.json() as Promise<AuthSession>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data) setSession(data);
        else router.replace("/login");
        setChecked(true);
      })
      .catch(() => {
        // Network error or malformed response — proxy.ts is the real security boundary, so treat
        // this the same as "not authenticated" rather than stranding the user on a spinner forever.
        if (cancelled) return;
        router.replace("/login");
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, session, setSession, router]);

  // A cached session (from localStorage, persisted across tabs/reloads) is trusted for instant
  // render, but never left unverified indefinitely: reconcile it against the real cookie session
  // once per mount. This catches a stale cache left behind by a closed tab / crashed browser on a
  // shared machine (wrong name/role shown) or a session revoked server-side since the cache was
  // written — without adding a loading-state regression, since it doesn't block the initial render.
  useEffect(() => {
    if (!hasHydrated || !session) return;
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? (res.json() as Promise<AuthSession>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          if (data.user.id !== session.user.id || data.user.role !== session.user.role) setSession(data);
        } else {
          logout();
          router.replace("/login");
        }
      })
      .catch(() => {
        // Best-effort reconciliation only — a network error here doesn't invalidate the cache,
        // since proxy.ts / requireSession() still enforce the real cookie on every actual request.
      });
    return () => {
      cancelled = true;
    };
    // Intentionally runs once per mount (session/logout/setSession/router are stable references
    // from the store and Next.js router), not on every session-object change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasHydrated || !session) {
    if (hasHydrated && checked) {
      return <Spinner label="Redirecting to login…" />;
    }
    return <Spinner label="Checking your session…" />;
  }

  return <>{children}</>;
}
