"use client";

import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageTransition } from "@/components/layout/PageTransition";
import { useAuthStore } from "@/lib/store/authStore";
import type { AuthSession } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextErrors: { name?: string; email?: string; password?: string } = {};
    if (!name.trim()) nextErrors.name = "Name is required.";
    if (!email.includes("@")) nextErrors.email = "Enter a valid email address.";
    if (password.length < 6) nextErrors.password = "Password must be at least 6 characters.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json()) as AuthSession | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Registration failed.");
      }
      setSession(data);
      router.push("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <ListChecks className="text-dsat" size={28} aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
          <p className="text-sm text-foreground-muted">Start tracking your DSAT, AP & IELTS progress.</p>
        </div>
        <Card>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              autoComplete="name"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              autoComplete="new-password"
              required
            />
            {formError && (
              <p role="alert" className="text-sm text-red-500">
                {formError}
              </p>
            )}
            <Button type="submit" accent="dsat" disabled={submitting} className="mt-1 w-full">
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-dsat hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}
