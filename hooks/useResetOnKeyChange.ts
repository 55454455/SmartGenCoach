"use client";

import { useState } from "react";

/**
 * Runs `onChange` synchronously during render, exactly once, the first render after `key`
 * differs from the previous render's key — React's sanctioned "adjust state when a prop
 * changes" escape hatch (see
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 * Only call setState from `onChange`, never anything that touches an external system (timers,
 * media devices, network) — this runs during render and may be discarded or repeated.
 */
export function useResetOnKeyChange(key: string | number, onChange: () => void): void {
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    onChange();
  }
}
