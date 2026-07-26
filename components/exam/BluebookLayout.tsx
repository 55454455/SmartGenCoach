"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Calculator, ChevronDown, ChevronLeft, ChevronRight, Eraser, EyeOff, FileText, Grid3x3, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Accent } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";
import { QuestionNavigatorGrid } from "./QuestionNavigatorGrid";

interface NavigatorItem {
  questionId: string;
  answered: boolean;
  flagged: boolean;
}

const HEADER_ACCENT_BORDER: Record<Accent, string> = {
  dsat: "border-b-2 border-b-dsat",
  ap: "border-b-2 border-b-ap",
  ielts: "border-b-2 border-b-ielts",
  studio: "border-b-2 border-b-studio",
  neutral: "border-b border-border",
};

const NEXT_BUTTON_ACCENT: Record<Accent, string> = {
  dsat: "bg-dsat hover:bg-dsat/90 text-white",
  ap: "bg-ap hover:bg-ap/90 text-white",
  ielts: "bg-ielts hover:bg-ielts/90 text-white",
  studio: "bg-studio hover:bg-studio/90 text-white",
  neutral: "bg-foreground hover:bg-foreground/90 text-background",
};

interface BluebookLayoutProps {
  title: string;
  /** Which exam this session belongs to — tints the header rule and the primary "Next" action. */
  accent?: Accent;
  studentName: string;
  onExit: () => void;
  timerFormatted: string;
  timerHidden: boolean;
  onToggleTimerHidden: () => void;
  directionsOpen: boolean;
  onToggleDirections: () => void;
  directionsText: string;
  showCalculatorButton: boolean;
  calculatorOpen: boolean;
  onToggleCalculator: () => void;
  eliminatorMode: boolean;
  onToggleEliminatorMode: () => void;
  navigatorOpen: boolean;
  onToggleNavigator: () => void;
  navigatorItems: NavigatorItem[];
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  flagged: boolean;
  onToggleFlag: () => void;
  onBack: () => void;
  onNext: () => void;
  backDisabled: boolean;
  nextLabel: string;
  children: ReactNode;
}

export function BluebookLayout({
  title,
  accent = "neutral",
  studentName,
  onExit,
  timerFormatted,
  timerHidden,
  onToggleTimerHidden,
  directionsOpen,
  onToggleDirections,
  directionsText,
  showCalculatorButton,
  calculatorOpen,
  onToggleCalculator,
  eliminatorMode,
  onToggleEliminatorMode,
  navigatorOpen,
  onToggleNavigator,
  navigatorItems,
  currentIndex,
  onSelectQuestion,
  flagged,
  onToggleFlag,
  onBack,
  onNext,
  backDisabled,
  nextLabel,
  children,
}: BluebookLayoutProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col">
      <header className={cn("flex flex-col bg-surface transition-colors", HEADER_ACCENT_BORDER[accent])}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit exam"
              className="flex shrink-0 items-center gap-1 rounded-md p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
            <span className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</span>
            <button
              type="button"
              onClick={onToggleDirections}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              aria-expanded={directionsOpen}
            >
              Directions
              <ChevronDown size={14} className={cn("transition-transform", directionsOpen && "rotate-180")} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {!timerHidden && (
              <span className="rounded-md bg-surface-muted px-2.5 py-1 font-mono text-sm font-semibold text-foreground" aria-live="off">
                {timerFormatted}
              </span>
            )}
            <button
              type="button"
              onClick={onToggleTimerHidden}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground"
            >
              <EyeOff size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{timerHidden ? "Show" : "Hide"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleEliminatorMode}
              aria-pressed={eliminatorMode}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-surface-muted",
                eliminatorMode ? "bg-surface-muted text-foreground" : "text-foreground-muted",
              )}
              title="Answer Eliminator"
            >
              <Eraser size={16} aria-hidden="true" />
              <span className="hidden md:inline">ABC</span>
            </button>
            <button
              type="button"
              className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground sm:flex"
              title="Annotate"
            >
              <FileText size={16} aria-hidden="true" />
              <span className="hidden md:inline">Annotate</span>
            </button>
            {showCalculatorButton && (
              <button
                type="button"
                onClick={onToggleCalculator}
                aria-pressed={calculatorOpen}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-surface-muted",
                  calculatorOpen ? "bg-surface-muted text-foreground" : "text-foreground-muted",
                )}
                title="Calculator"
              >
                <Calculator size={16} aria-hidden="true" />
                <span className="hidden md:inline">Calculator</span>
              </button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {directionsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border bg-surface-muted"
            >
              <p className="px-4 py-3 text-sm text-foreground-muted sm:px-6">{directionsText}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <footer className="relative flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 sm:px-6">
        <span className="hidden truncate text-sm font-medium text-foreground sm:inline">{studentName}</span>

        <div className="relative flex flex-1 items-center justify-center gap-2 sm:flex-none">
          <button
            type="button"
            onClick={onToggleFlag}
            aria-pressed={flagged}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-surface-muted",
              flagged ? "text-amber-500" : "text-foreground-muted",
            )}
          >
            <Bookmark size={14} className={cn(flagged && "fill-amber-500")} aria-hidden="true" />
            <span className="hidden sm:inline">Mark for Review</span>
          </button>

          <button
            type="button"
            onClick={onToggleNavigator}
            aria-expanded={navigatorOpen}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <Grid3x3 size={14} aria-hidden="true" />
            Question {currentIndex + 1} of {navigatorItems.length}
          </button>

          <AnimatePresence>
            {navigatorOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-2 w-72 rounded-xl border border-border bg-surface shadow-lg"
              >
                <QuestionNavigatorGrid items={navigatorItems} currentIndex={currentIndex} onSelect={onSelectQuestion} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={backDisabled}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className={cn(
              "flex items-center gap-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              NEXT_BUTTON_ACCENT[accent],
            )}
          >
            {nextLabel}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
}
