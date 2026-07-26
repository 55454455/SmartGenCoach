"use client";

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Accent } from "@/lib/utils/accent";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  accent?: Accent;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  accent = "neutral",
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={buttonClasses({ variant, size, accent, className })}
      disabled={disabled}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
}
