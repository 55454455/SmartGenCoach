"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/select-exam", label: "Select Exam", icon: GraduationCap },
  { href: "/killing-questions", label: "Killing Questions", icon: Target },
  { href: "/smart-studio", label: "Smart Studio", icon: Sparkles },
  { href: "/lets-play", label: "Let's Play", icon: Swords },
];

const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldCheck };

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const navLinks = session?.user.role === "admin" ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS;

  async function handleLogout() {
    await createClient().auth.signOut();
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-foreground">
          <ListChecks className="text-[var(--accent-current)] transition-colors duration-300" size={22} aria-hidden="true" />
          <span>SmartGenCoach</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent-current-soft)] text-[var(--accent-current)]"
                    : "text-foreground-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {session && (
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-current-soft)] text-xs font-semibold text-[var(--accent-current)] transition-colors duration-300">
                {session.user.avatarInitials}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground-muted hover:text-foreground"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-surface md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </Link>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                <ThemeToggle />
                {session && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-medium text-foreground-muted hover:text-foreground"
                  >
                    <LogOut size={16} aria-hidden="true" />
                    Log out
                  </button>
                )}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
