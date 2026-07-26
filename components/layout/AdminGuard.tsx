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
    if (hasHydrated && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [hasHydrated, isAdmin, router]);

  if (!hasHydrated || !isAdmin) {
    return <Spinner label="Checking permissions…" />;
  }

  return <>{children}</>;
}
