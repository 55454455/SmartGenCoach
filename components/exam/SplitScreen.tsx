"use client";

import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface SplitScreenProps {
  left: ReactNode;
  right: ReactNode;
}

/** Draggable divider on desktop (like Bluebook's passage/question split); stacked on mobile. */
export function SplitScreen({ left, right }: SplitScreenProps) {
  const [leftWidthPct, setLeftWidthPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragAbortRef = useRef<AbortController | null>(null);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((event.clientX - rect.left) / rect.width) * 100;
    setLeftWidthPct(Math.min(75, Math.max(25, pct)));
  }, []);

  const stopDragging = useCallback(() => {
    draggingRef.current = false;
    dragAbortRef.current?.abort();
    dragAbortRef.current = null;
  }, []);

  const startDragging = useCallback(() => {
    draggingRef.current = true;
    const controller = new AbortController();
    dragAbortRef.current = controller;
    window.addEventListener("pointermove", handlePointerMove, { signal: controller.signal });
    window.addEventListener("pointerup", stopDragging, { signal: controller.signal });
  }, [handlePointerMove, stopDragging]);

  useEffect(() => () => dragAbortRef.current?.abort(), []);

  const leftPaneStyle: CSSProperties & Record<"--split-left", string> = {
    "--split-left": `${leftWidthPct}%`,
  };

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
      <div
        className="min-h-0 overflow-y-auto border-b border-border p-4 sm:p-6 lg:w-[var(--split-left)] lg:shrink-0 lg:border-b-0 lg:border-r"
        style={leftPaneStyle}
      >
        {left}
      </div>

      <button
        type="button"
        aria-label="Drag to resize panes"
        onPointerDown={startDragging}
        className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center bg-surface-muted hover:bg-border lg:flex"
      >
        <GripVertical size={14} className="text-foreground-muted" aria-hidden="true" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{right}</div>
    </div>
  );
}
