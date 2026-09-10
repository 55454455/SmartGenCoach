"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { Spinner } from "@/components/ui/Spinner";

// PHASE2: this client-side role check becomes a server-side guard backed by a Supabase JWT
// "admin" claim (middleware), so non-admin requests never reach this route at all.
export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const session = useAuthStore((s) => s.session);
  const isAdmin = session?.user.role === "admin";

  useEffect(() => {
    if (!hasHydrated || isAdmin) return;
    // No session at all (shouldn't normally happen — the (app) layout's AuthGuard wraps every
    // route here — but don't claim "you're logged in but not admin" when nobody is logged in).
    router.replace(session ? "/dashboard" : "/login");
  }, [hasHydrated, isAdmin, session, router]);

  if (!hasHydrated || !isAdmin) {
    return <Spinner label="Checking permissions…" />;
  }

  return <>{children}</>;
}
