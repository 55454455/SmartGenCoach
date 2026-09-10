"use client";

import { CheckCircle2, ListChecks } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LinkButton } from "@/components/ui/LinkButton";
import { Spinner } from "@/components/ui/Spinner";
import { PageTransition } from "@/components/layout/PageTransition";
import { createClient } from "@/lib/supabase/client";

// The emailed reset link lands here as a PKCE `?code=...` param. @supabase/ssr's browser client
// has detectSessionInUrl on by default, so simply constructing it exchanges that code for a real
// (temporary "recovery") session automatically — but that exchange is async, so the form stays
// hidden behind a "checking" state until supabase.auth.getSession() confirms it landed, rather
// than racing the reset submission against session setup.
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextErrors: { password?: string; confirmPassword?: string } = {};
    if (password.length < 6) nextErrors.password = "Password must be at least 6 characters.";
    if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords don't match.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: true } | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not reset your password.");
      }
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return <Spinner label="Checking your reset link…" />;
  }

  if (status === "invalid") {
    return (
      <PageTransition>
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex flex-col items-center gap-2">
            <ListChecks className="text-dsat" size={28} aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">This link is invalid or has expired</h1>
            <p className="text-sm text-foreground-muted">Request a new password reset link to continue.</p>
          </div>
          <LinkButton href="/forgot-password" accent="dsat">
            Request a new link
          </LinkButton>
        </div>
      </PageTransition>
    );
  }

  if (done) {
    return (
      <PageTransition>
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex flex-col items-center gap-2">
            <CheckCircle2 className="text-dsat" size={28} aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">Password updated</h1>
            <p className="text-sm text-foreground-muted">You can now sign in with your new password.</p>
          </div>
          <LinkButton href="/login" accent="dsat">
            Sign in
          </LinkButton>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <ListChecks className="text-dsat" size={28} aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
          <p className="text-sm text-foreground-muted">Choose a new password for your account.</p>
        </div>
        <Card>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
              required
            />
            {formError && (
              <p role="alert" className="text-sm text-red-500">
                {formError}
              </p>
            )}
            <Button type="submit" accent="dsat" disabled={submitting} className="mt-1 w-full">
              {submitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-foreground-muted">
          <Link href="/login" className="font-medium text-dsat hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}
