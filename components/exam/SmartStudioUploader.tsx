"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { SmartStudioTest } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface SmartStudioUploaderProps {
  onUploaded: (test: SmartStudioTest) => void;
}

export function SmartStudioUploader({ onUploaded }: SmartStudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/smart-studio", { method: "POST", body: formData });
      const data = (await res.json()) as SmartStudioTest | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Upload failed.");
      }
      onUploaded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reading that file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <Card
      className={cn(
        "flex flex-col items-center gap-3 border-2 border-dashed py-10 text-center transition-colors",
        dragActive ? "border-studio bg-studio-soft" : "border-border",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        <Spinner label="Smart Studio is reading your document…" />
      ) : (
        <>
          <UploadCloud size={28} className="text-studio" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Upload any test paper, PDF, or screenshot</p>
            <p className="mt-1 text-sm text-foreground-muted">PDF, photo, or screenshot — drag & drop or</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-studio px-4 py-2 text-sm font-medium text-studio hover:bg-studio-soft"
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
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
