"use client";

import { Link2, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { ExamType, UploadedExam } from "@/lib/types";
import { accentForExam, type Accent } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";

interface ExamSourceUploaderProps {
  examType: ExamType;
  onCreated: (exam: UploadedExam) => void;
}

const ACCENT_BORDER: Record<Accent, string> = {
  dsat: "border-dsat",
  ap: "border-ap",
  ielts: "border-ielts",
  studio: "border-studio",
  neutral: "border-foreground",
};
const ACCENT_BG_SOFT: Record<Accent, string> = {
  dsat: "bg-dsat-soft",
  ap: "bg-ap-soft",
  ielts: "bg-ielts-soft",
  studio: "bg-studio-soft",
  neutral: "bg-surface-muted",
};
const ACCENT_TEXT: Record<Accent, string> = {
  dsat: "text-dsat",
  ap: "text-ap",
  ielts: "text-ielts",
  studio: "text-studio",
  neutral: "text-foreground",
};

type SourceTab = "document" | "url";

export function ExamSourceUploader({ examType, onCreated }: ExamSourceUploaderProps) {
  const accent = accentForExam(examType);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<SourceTab>("document");
  const [url, setUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(sourceType: SourceTab, opts: { file?: File; sourceUrl?: string }) {
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("examType", examType);
      formData.append("sourceType", sourceType);
      if (opts.file) formData.append("file", opts.file);
      if (opts.sourceUrl) formData.append("sourceUrl", opts.sourceUrl);
      const res = await fetch("/api/exam/upload", { method: "POST", body: formData });
      const data = (await res.json()) as UploadedExam | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Upload failed.");
      }
      onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong building that exam. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFile(file: File) {
    void submit("document", { file });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleUrlSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    void submit("url", { sourceUrl: trimmed });
  }

  if (submitting) {
    return (
      <Card className="py-10">
        <Spinner label="Building your exam from that source…" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-lg border border-border bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => setTab("document")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "document" ? `${ACCENT_BG_SOFT[accent]} ${ACCENT_TEXT[accent]}` : "text-foreground-muted hover:text-foreground",
          )}
        >
          Upload document
        </button>
        <button
          type="button"
          onClick={() => setTab("url")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "url" ? `${ACCENT_BG_SOFT[accent]} ${ACCENT_TEXT[accent]}` : "text-foreground-muted hover:text-foreground",
          )}
        >
          Paste a URL
        </button>
      </div>

      {tab === "document" ? (
        <div
          className={cn(
            "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-10 text-center transition-colors",
            dragActive ? `${ACCENT_BORDER[accent]} ${ACCENT_BG_SOFT[accent]}` : "border-border",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <UploadCloud size={28} className={ACCENT_TEXT[accent]} aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Upload a past test paper</p>
            <p className="mt-1 text-sm text-foreground-muted">PDF, photo, or screenshot — drag & drop or</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium hover:bg-surface-muted",
              ACCENT_BORDER[accent],
              ACCENT_TEXT[accent],
            )}
          >
            Choose a file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 py-4">
          <label htmlFor="exam-source-url" className="text-sm font-medium text-foreground">
            Link to the test you&apos;d like to import
          </label>
          <div className="flex gap-2">
            <input
              id="exam-source-url"
              type="url"
              inputMode="url"
              placeholder="https://example.com/practice-test"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-foreground-muted"
            />
            <button
              type="button"
              onClick={handleUrlSubmit}
              disabled={!url.trim()}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40",
                ACCENT_BORDER[accent],
                ACCENT_TEXT[accent],
              )}
            >
              <Link2 size={14} aria-hidden="true" />
              Import
            </button>
          </div>
          <p className="text-xs text-foreground-muted">
            We&apos;ll extract the questions from that page and embed them here as a new exam, just like the others.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </Card>
  );
}
