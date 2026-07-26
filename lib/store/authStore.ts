import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession } from "@/lib/types";

interface AuthState {
  session: AuthSession | null;
  hasHydrated: boolean;
  setSession: (session: AuthSession) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

// Client-side cache of the current user's profile for instant UI reads (name, avatar, role).
// It is NOT the security boundary — proxy.ts enforces auth from the real Supabase session
// cookie on every request, so a stale or missing cache here only affects UI, never access.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hasHydrated: false,
      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "test-prep-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
