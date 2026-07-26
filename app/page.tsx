"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/lib/store/authStore";

export default function RootPage() {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!hasHydrated) return;
    router.replace(session ? "/dashboard" : "/login");
  }, [hasHydrated, session, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner label="Loading SmartGenCoach…" />
    </div>
  );
}
