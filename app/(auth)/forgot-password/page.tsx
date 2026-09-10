"use client";

import { ListChecks, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageTransition } from "@/components/layout/PageTransition";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!email.includes("@")) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok: true } | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not send the reset email.");
      }
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <PageTransition>
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex flex-col items-center gap-2">
            <MailCheck className="text-dsat" size={28} aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">Check your inbox</h1>
            <p className="text-sm text-foreground-muted">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve sent a
              link to reset your password.
            </p>
          </div>
          <Link href="/login" className="text-sm font-medium text-dsat hover:underline">
            Back to sign in
          </Link>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <ListChecks className="text-dsat" size={28} aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
          <p className="text-sm text-foreground-muted">Enter your email and we&apos;ll send you a link to reset it.</p>
        </div>
        <Card>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldError}
              autoComplete="email"
              required
            />
            {formError && (
              <p role="alert" className="text-sm text-red-500">
                {formError}
              </p>
            )}
            <Button type="submit" accent="dsat" disabled={submitting} className="mt-1 w-full">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-foreground-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-dsat hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}
