"use client";

import { motion } from "framer-motion";
import type { Accent } from "@/lib/utils/accent";

export interface StatChartPoint {
  label: string;
  value: number;
}

interface StatChartProps {
  data: StatChartPoint[];
  maxValue: number;
  accent?: Accent;
  height?: number;
  ariaLabel: string;
}

const ACCENT_STROKE: Record<Accent, string> = {
  dsat: "var(--accent-dsat)",
  ap: "var(--accent-ap)",
  ielts: "var(--accent-ielts)",
  studio: "var(--accent-studio)",
  neutral: "var(--foreground)",
};

const WIDTH = 320;
const PADDING = 24;

export function StatChart({ data, maxValue, accent = "neutral", height = 140, ariaLabel }: StatChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-foreground-muted">No attempts yet.</p>;
  }

  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = height - PADDING * 2;
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PADDING + i * stepX;
    const ratio = maxValue > 0 ? d.value / maxValue : 0;
    const y = PADDING + innerHeight * (1 - Math.min(1, ratio));
    return { x, y, ...d };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const stroke = ACCENT_STROKE[accent];

  return (
    <div role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
        <line x1={PADDING} y1={height - PADDING} x2={WIDTH - PADDING} y2={height - PADDING} className="stroke-border" strokeWidth={1} />
        <motion.polyline
          points={polylinePoints}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={stroke} />
            <text x={p.x} y={height - PADDING + 16} textAnchor="middle" className="fill-foreground-muted" fontSize={9}>
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
