"use client";

import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavigatorItem {
  questionId: string;
  answered: boolean;
  flagged: boolean;
}

interface QuestionNavigatorGridProps {
  items: NavigatorItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function QuestionNavigatorGrid({ items, currentIndex, onSelect }: QuestionNavigatorGridProps) {
  return (
    <div className="grid grid-cols-5 gap-2 p-3 sm:grid-cols-6">
      {items.map((item, index) => (
        <button
          key={item.questionId}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Go to question ${index + 1}${item.answered ? ", answered" : ", unanswered"}${item.flagged ? ", flagged for review" : ""}`}
          aria-current={index === currentIndex ? "true" : undefined}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
            index === currentIndex
              ? "border-foreground bg-foreground text-background"
              : item.answered
                ? "border-border bg-surface-muted text-foreground"
                : "border-dashed border-border text-foreground-muted hover:bg-surface-muted",
          )}
        >
          {index + 1}
          {item.flagged && (
            <Bookmark
              size={12}
              className="absolute -right-1 -top-1 fill-amber-500 text-amber-500"
              aria-hidden="true"
            />
          )}
        </button>
      ))}
    </div>
  );
}
