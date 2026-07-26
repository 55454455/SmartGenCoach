import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import type { Accent } from "@/lib/utils/accent";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  accent?: Accent;
  className?: string;
  children: ReactNode;
}

export function LinkButton({ variant = "primary", size = "md", accent = "neutral", className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses({ variant, size, accent, className })} {...rest}>
      {children}
    </Link>
  );
}
