"use client";

import { motion } from "framer-motion";
import type { Accent } from "@/lib/utils/accent";

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  accent?: Accent;
  label?: string;
  sublabel?: string;
  ariaLabel: string;
}

const ACCENT_STROKE: Record<Accent, string> = {
  dsat: "var(--accent-dsat)",
  ap: "var(--accent-ap)",
  ielts: "var(--accent-ielts)",
  studio: "var(--accent-studio)",
  party: "var(--accent-party)",
  neutral: "var(--foreground)",
};

export function ProgressRing({
  value,
  size = 108,
  strokeWidth = 10,
  accent = "neutral",
  label,
  sublabel,
  ariaLabel,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={ariaLabel}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-border"
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={ACCENT_STROKE[accent]}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl font-semibold text-foreground">{label ?? `${Math.round(clamped)}%`}</span>
        {sublabel && <span className="text-xs text-foreground-muted">{sublabel}</span>}
      </div>
    </div>
  );
}
