"use client";

import { useEffect, useRef, useState } from "react";
import { useResetOnKeyChange } from "./useResetOnKeyChange";

interface UseCountdownOptions {
  onExpire?: () => void;
  paused?: boolean;
}

export function useCountdown(durationSeconds: number, { onExpire, paused = false }: UseCountdownOptions = {}) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useResetOnKeyChange(durationSeconds, () => setSecondsLeft(durationSeconds));

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, durationSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return { secondsLeft, formatted };
}
