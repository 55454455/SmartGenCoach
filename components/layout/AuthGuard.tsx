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
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasHydrated || session) return;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? (res.json() as Promise<AuthSession>) : null))
      .then((data) => {
        if (data) setSession(data);
        else router.replace("/login");
        setChecked(true);
      });
  }, [hasHydrated, session, setSession, router]);

  if (!hasHydrated || !session) {
    if (hasHydrated && checked) {
      return <Spinner label="Redirecting to login…" />;
    }
    return <Spinner label="Checking your session…" />;
  }

  return <>{children}</>;
}
