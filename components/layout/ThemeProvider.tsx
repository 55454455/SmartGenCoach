"use client";

import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "@/lib/store/themeStore";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <>{children}</>;
}
