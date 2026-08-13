"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { AuthScreenLayout } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PortalKey } from "@/lib/auth-cookies";

const portalCopy: Record<PortalKey, { title: string; description: string }> = {
  "super-admin": { title: "Super Admin sign in", description: "Access platform administration." },
  tenant: { title: "Tenant sign in", description: "Access your organisation workspace." },
  employee: { title: "Employee sign in", description: "Access your assigned work." },
  client: { title: "Client sign in", description: "Access your client portal." },
};

const portalChoices: Array<{ href: string; label: string; description: string }> = [
  { href: "/super-admin/login", label: "Administrator", description: "Platform administration" },
  { href: "/admin/login", label: "Tenant", description: "Organisation workspace" },
  { href: "/employee/login", label: "Employee", description: "Assigned work" },
  { href: "/client/login", label: "Client", description: "Client portal" },
];

export function PortalLoginForm({ portal }: { portal: PortalKey }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const copy = portalCopy[portal];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${portal}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json().catch(() => null) as { redirect?: string; message?: string; error?: { message?: string } } | null;
      if (!response.ok || !body?.redirect) {
        setError(body?.error?.message ?? body?.message ?? "Unable to sign in.");
        return;
      }
      window.location.assign(body.redirect);
    } catch {
      setError("Unable to reach the authentication service.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreenLayout>
      <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 lg:p-7 lg:pb-0">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border bg-muted text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-[28px] leading-8 sm:text-[30px]">{copy.title}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-7 pt-0 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7">
        <form className="mt-7 grid gap-5 lg:mt-5 lg:gap-4" onSubmit={submit} noValidate>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              required
              placeholder="name@company.com"
              className="h-12 rounded-lg px-3.5 lg:h-11"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm font-semibold">
            <label htmlFor={`${portal}-password`}>Password <span data-required-marker aria-hidden="true">*</span></label>
            <span className="relative">
              <Input
                id={`${portal}-password`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="h-12 rounded-lg px-3.5 pr-11 lg:h-11"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </div>
          {error ? <p role="alert" className="rounded-lg border border-danger/25 bg-[var(--chip-danger-bg)] p-3 text-sm text-danger">{error}</p> : null}
          <Button className="h-12 w-full rounded-lg text-[15px] font-semibold shadow-sm active:translate-y-px lg:h-11" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-7 border-t pt-5 text-center text-sm text-muted-foreground lg:mt-5 lg:pt-4">
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Choose a different portal</Link>
        </div>
      </CardContent>
    </AuthScreenLayout>
  );
}

export function PortalSignInSelector() {
  return (
    <AuthScreenLayout>
      <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 lg:p-7 lg:pb-0">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border bg-muted text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-[28px] leading-8 sm:text-[30px]">Sign in</CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose the portal assigned to your account.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-7 pt-0 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7">
        <nav className="mt-7 grid gap-3 lg:mt-5" aria-label="Sign-in portals">
          {portalChoices.map((portal) => (
            <Link key={portal.href} href={portal.href} className="rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block text-sm font-semibold">{portal.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{portal.description}</span>
            </Link>
          ))}
        </nav>
      </CardContent>
    </AuthScreenLayout>
  );
}
