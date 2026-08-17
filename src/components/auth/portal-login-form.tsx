"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, ChevronRight, Eye, EyeOff, Globe2, LoaderCircle, ShieldCheck, UserRound, UsersRound } from "lucide-react";
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

const portalChoices: Array<{ href: string; label: string; description: string; icon: typeof UsersRound }> = [
  { href: "/super-admin/login", label: "Administrator", description: "Platform administration", icon: UsersRound },
  { href: "/admin/login", label: "Tenant", description: "Organisation workspace", icon: Building2 },
  { href: "/employee/login", label: "Employee", description: "Assigned work", icon: UserRound },
  { href: "/client/login", label: "Client", description: "Client portal", icon: Globe2 },
];

const loginCardClassName = "border-[#e0e6f0] bg-white text-[#172033] shadow-[0_18px_45px_rgb(38_55_92/0.11)]";
const loginInputClassName = "border-[#dce3ef] bg-white text-[#172033] placeholder:text-[#8491a8] focus-visible:border-[#6074ff] focus-visible:ring-[#6074ff]";

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
        setError(
          body?.error?.message ??
            body?.message ??
            (response.status === 503
              ? "The API is starting up. Wait about 30 seconds and sign in again."
              : "Unable to sign in."),
        );
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
    <AuthScreenLayout cardClassName={loginCardClassName}>
      <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 lg:p-7 lg:pb-0">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl border border-[#e0e7f4] bg-[#f5f7ff] text-[#315cff]">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-[28px] leading-8 text-[#172033] sm:text-[30px]">{copy.title}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-[#687899]">{copy.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-7 pt-0 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7">
        <form className="mt-7 grid gap-5 lg:mt-5 lg:gap-4" onSubmit={submit} noValidate>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[#243047]">
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              required
              placeholder="name@company.com"
              className={`h-12 rounded-lg px-3.5 lg:h-11 ${loginInputClassName}`}
            />
          </label>
          <div className="flex flex-col gap-2 text-sm font-semibold text-[#243047]">
            <label htmlFor={`${portal}-password`}>Password <span data-required-marker aria-hidden="true">*</span></label>
            <span className="relative">
              <Input
                id={`${portal}-password`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className={`h-12 rounded-lg px-3.5 pr-11 lg:h-11 ${loginInputClassName}`}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#8491a8] transition-colors hover:bg-[#f3f5fb] hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6074ff]"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </div>
          {error ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
          <Button className="h-12 w-full rounded-lg bg-[#5268ed] text-[15px] font-semibold text-white shadow-sm hover:bg-[#4058df] active:translate-y-px lg:h-11" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-7 border-t border-[#e5e9f1] pt-5 text-center text-sm lg:mt-5 lg:pt-4">
          <Link href="/login" className="font-semibold text-[#5268ed] underline-offset-4 hover:underline">Choose a different portal</Link>
        </div>
      </CardContent>
    </AuthScreenLayout>
  );
}

export function PortalSignInSelector() {
  return (
    <AuthScreenLayout cardClassName={loginCardClassName}>
      <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 lg:p-7 lg:pb-0">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl border border-[#e0e7f4] bg-[#f5f7ff] text-[#315cff]">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-[28px] leading-8 text-[#172033] sm:text-[30px]">Sign in</CardTitle>
            <p className="mt-1 text-sm leading-6 text-[#687899]">Choose the portal assigned to your account.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-7 pt-0 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7">
        <nav className="mt-7 grid gap-3 lg:mt-5" aria-label="Sign-in portals">
          {portalChoices.map((portal) => {
            const Icon = portal.icon;
            return <Link key={portal.href} href={portal.href} className="group flex items-center gap-4 rounded-xl border border-[#e2e7f0] px-3.5 py-3.5 shadow-[0_3px_8px_rgb(38_55_92/0.03)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-[#cfd8ef] hover:shadow-[0_8px_18px_rgb(38_55_92/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6074ff] motion-reduce:transform-none">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f1f4ff] text-[#315cff]"><Icon className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#172033]">{portal.label}</span><span className="mt-0.5 block text-xs text-[#687899]">{portal.description}</span></span>
              <ChevronRight className="size-5 shrink-0 text-[#9aa8c1] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          })}
        </nav>
      </CardContent>
    </AuthScreenLayout>
  );
}
