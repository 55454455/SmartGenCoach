"use client";

import { motion } from "framer-motion";
import type { Accent } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  value: number; // 0-100
  accent?: Accent;
  className?: string;
  ariaLabel: string;
}

const ACCENT_BG: Record<Accent, string> = {
  dsat: "bg-dsat",
  ap: "bg-ap",
  ielts: "bg-ielts",
  studio: "bg-studio",
  neutral: "bg-foreground",
};

export function ProgressBar({ value, accent = "neutral", className, ariaLabel }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <motion.div
        className={cn("h-full rounded-full", ACCENT_BG[accent])}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}
