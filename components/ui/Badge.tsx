import type { HTMLAttributes } from "react";
import type { Accent } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  accent?: Accent;
}

const ACCENT_CLASSES: Record<Accent, string> = {
  dsat: "bg-dsat-soft text-dsat",
  ap: "bg-ap-soft text-ap",
  ielts: "bg-ielts-soft text-ielts",
  studio: "bg-studio-soft text-studio",
  party: "bg-party-soft text-party",
  neutral: "bg-surface-muted text-foreground-muted",
};

export function Badge({ accent = "neutral", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        ACCENT_CLASSES[accent],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
