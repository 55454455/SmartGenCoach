"use client";

import { useEffect } from "react";
import type { Accent } from "@/lib/utils/accent";

/**
 * Sets the page-wide "current exam" accent (--accent-current / --accent-current-soft) on
 * <html> for as long as the calling component is mounted, then reverts it on unmount/change.
 *
 * This drives "Full Immersion" per-exam theming: shared chrome that doesn't get an `accent`
 * prop directly (TopNav logo/avatar, focus rings, page-level wash backgrounds via
 * `bg-[var(--accent-current-wash)]`) all read these CSS variables, so entering a DSAT page
 * turns that shared chrome blue, entering IELTS turns it green, etc., without prop-drilling
 * through the layout tree.
 *
 * Pass `null` (or "neutral") when there's no single exam context for the current page (e.g.
 * the Dashboard, which shows all exams at once) — the variables fall back to the DSAT default
 * defined in globals.css, matching the app's original static chrome color.
 */
export function useExamTheme(accent: Accent | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (!accent || accent === "neutral") {
      root.style.removeProperty("--accent-current");
      root.style.removeProperty("--accent-current-soft");
      return;
    }
    root.style.setProperty("--accent-current", `var(--accent-${accent})`);
    root.style.setProperty("--accent-current-soft", `var(--accent-${accent}-soft)`);
    return () => {
      root.style.removeProperty("--accent-current");
      root.style.removeProperty("--accent-current-soft");
    };
  }, [accent]);
}
