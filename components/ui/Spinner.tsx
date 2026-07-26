import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-foreground-muted" role="status" aria-live="polite">
      <Loader2 className={cn("animate-spin", className)} size={20} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
