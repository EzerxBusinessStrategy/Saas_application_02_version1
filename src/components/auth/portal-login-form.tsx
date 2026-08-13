"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PortalKey } from "@/lib/auth-cookies";

const portalCopy: Record<PortalKey, { title: string; description: string }> = {
  "super-admin": { title: "Super Admin sign in", description: "Access platform administration." }, tenant: { title: "Tenant sign in", description: "Access your organisation workspace." }, employee: { title: "Employee sign in", description: "Access your assigned work." }, client: { title: "Client sign in", description: "Access your client portal." },
};

export function PortalLoginForm({ portal }: { portal: PortalKey }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const copy = portalCopy[portal];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${portal}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await response.json().catch(() => null) as { redirect?: string; message?: string; error?: { message?: string } } | null;
      if (!response.ok || !body?.redirect) { setError(body?.error?.message ?? body?.message ?? "Unable to sign in."); return; }
      window.location.assign(body.redirect);
    } catch { setError("Unable to reach the authentication service."); } finally { setSubmitting(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-8"><Card className="w-full max-w-md rounded-lg"><CardHeader><div className="flex items-center gap-3"><ShieldCheck className="size-6 text-primary" aria-hidden="true" /><div><CardTitle>{copy.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{copy.description}</p></div></div></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><label className="grid gap-2 text-sm font-medium">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label className="grid gap-2 text-sm font-medium">Password<span className="relative"><Input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="pr-11" /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<Button type="submit" className="w-full" disabled={submitting}>{submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}Sign in</Button></form></CardContent></Card></main>;
}
