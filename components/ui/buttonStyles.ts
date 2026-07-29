import type { Accent } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-base px-5 py-2.5 gap-2",
};

const ACCENT_BG: Record<Accent, string> = {
  dsat: "bg-dsat hover:bg-dsat/90 text-white",
  ap: "bg-ap hover:bg-ap/90 text-white",
  ielts: "bg-ielts hover:bg-ielts/90 text-white",
  studio: "bg-studio hover:bg-studio/90 text-white",
  party: "bg-party hover:bg-party/90 text-white",
  neutral: "bg-foreground hover:bg-foreground/90 text-background",
};

const ACCENT_OUTLINE: Record<Accent, string> = {
  dsat: "border-dsat text-dsat hover:bg-dsat-soft",
  ap: "border-ap text-ap hover:bg-ap-soft",
  ielts: "border-ielts text-ielts hover:bg-ielts-soft",
  studio: "border-studio text-studio hover:bg-studio-soft",
  party: "border-party text-party hover:bg-party-soft",
  neutral: "border-border text-foreground hover:bg-surface-muted",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  accent = "neutral",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  accent?: Accent;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClass =
    variant === "primary"
      ? ACCENT_BG[accent]
      : variant === "danger"
        ? "bg-red-600 hover:bg-red-700 text-white"
        : variant === "secondary"
          ? cn("border bg-surface", ACCENT_OUTLINE[accent])
          : "text-foreground-muted hover:text-foreground hover:bg-surface-muted";

  return cn(base, SIZE_CLASSES[size], variantClass, className);
}
