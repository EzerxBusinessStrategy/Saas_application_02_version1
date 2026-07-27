"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeCheck,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OperationalNetwork } from "@/components/auth/operational-network";
import { loginRoles } from "@/lib/demo-auth";

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, "Enter your sign-in identifier."),
    password: z.string().min(1, "Enter your password."),
    role: z.enum(loginRoles),
    rememberMe: z.boolean(),
  })
  .superRefine((data, context) => {
    if (!z.string().email().safeParse(data.identifier).success) {
      context.addIssue({
        code: "custom",
        path: ["identifier"],
        message: "Enter a valid work email.",
      });
    }
  });

const recoverySchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email."),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must contain at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type Mode = "login" | "recovery" | "reset" | "invitation";
type Values = {
  identifier?: string;
  password?: string;
  confirmPassword?: string;
  role?: (typeof loginRoles)[number];
  rememberMe?: boolean;
};

const content: Record<Mode, { title: string; description: string; action: string }> = {
  login: {
    title: "Sign in to SaaS App",
    description: "Use your work account to access your authorised workspace.",
    action: "Sign in",
  },
  recovery: {
    title: "Reset your password",
    description: "Enter your email to request a reset.",
    action: "Send reset link",
  },
  reset: {
    title: "Choose a new password",
    description: "Use at least 8 characters and keep it unique to your account.",
    action: "Save new password",
  },
  invitation: {
    title: "Accept your invitation",
    description: "Set a password to activate your SaaS App account.",
    action: "Activate account",
  },
};

const valuePoints = [
  "Centralised administration",
  "Secure role-based access",
  "Built for multi-team operations",
];

export function AuthForm({ mode }: { mode: Mode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const schema =
    mode === "login"
      ? loginSchema
      : mode === "recovery"
        ? recoverySchema
        : passwordSchema;
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      identifier: "",
      password: "",
      confirmPassword: "",
      role: "SUPER_ADMIN",
      rememberMe: false,
    },
  });
  const role = watch("role") ?? "SUPER_ADMIN";
  const isLogin = mode === "login";
  const details = content[mode];
  const passwordMode = isLogin || mode === "reset" || mode === "invitation";

  const onSubmit = async (values: Values) => {
    setServerError("");
    try {
      if (isLogin) {
        const response = await fetch("/api/demo-auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!response.ok) {
          setServerError("The sign-in details do not match the selected portal.");
          return;
        }
        const { workspace } = (await response.json()) as { workspace: string };
        window.location.assign(`/${workspace}`);
        return;
      }

      if (mode === "recovery") {
        await fetch("/api/demo-auth/recovery", { method: "POST" });
      }
      setSubmitted(true);
    } catch {
      setServerError("Unable to continue right now. Check your connection and try again.");
    }
  };

  const form = submitted ? (
    <p
      className="rounded-[var(--radius-control)] border border-success/20 bg-success/10 p-3 text-sm text-success"
      role="status"
    >
      {mode === "recovery"
        ? "If this identifier belongs to an account, a reset link will be sent."
        : "Your request is ready for the authentication service to complete."}
    </p>
  ) : (
    <form className="mt-7 flex flex-col gap-5 lg:mt-5 lg:gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {isLogin || mode === "recovery" ? (
        <label className="flex flex-col gap-2 text-sm font-semibold">
          {mode === "recovery" ? "Email" : "Work email"}
          <Input
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? "auth-identifier-error" : undefined}
            className="h-12 rounded-lg px-3.5 lg:h-11"
            {...register("identifier")}
          />
          {errors.identifier ? (
            <span id="auth-identifier-error" className="text-sm font-normal text-danger" role="alert">
              {errors.identifier.message}
            </span>
          ) : null}
        </label>
      ) : null}

      {passwordMode ? (
        <>
          <div className="flex flex-col gap-2 text-sm font-semibold">
            <label htmlFor="auth-password">Password</label>
            <span className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="h-12 rounded-lg px-3.5 pr-11 lg:h-11"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "auth-password-error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
            {errors.password ? (
              <span id="auth-password-error" className="text-sm font-normal text-danger" role="alert">
                {errors.password.message}
              </span>
            ) : null}
          </div>

          {mode !== "login" ? (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Confirm password
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="h-12 rounded-lg px-3.5 lg:h-11"
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? "auth-confirm-password-error" : undefined}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <span id="auth-confirm-password-error" className="text-sm font-normal text-danger" role="alert">
                  {errors.confirmPassword.message}
                </span>
              ) : null}
            </label>
          ) : null}
        </>
      ) : null}

      {isLogin ? (
        <div className="flex flex-col gap-2 text-sm font-semibold">
          <label htmlFor="auth-portal-access">Portal access</label>
          <Select id="auth-portal-access" aria-describedby="auth-role-help" className="h-12 rounded-lg px-3.5 lg:h-11" {...register("role")}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="TENANT_ADMIN">Tenant Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="CLIENT_USER">Client User</option>
          </Select>
          <span id="auth-role-help" className="text-sm font-normal text-muted-foreground">
            Select the portal assigned to your account.
          </span>
        </div>
      ) : null}

      {isLogin ? (
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("rememberMe")}
            />
            Remember me
          </label>
          <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
      ) : null}

      {serverError ? (
        <p className="rounded-lg border border-danger/25 bg-[var(--chip-danger-bg)] p-3 text-sm text-danger" role="alert">
          {serverError}
        </p>
      ) : null}

      <Button className="h-12 w-full rounded-lg text-[15px] font-semibold shadow-sm active:translate-y-px lg:h-11" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LockKeyhole className="size-4" aria-hidden="true" />}
        {isSubmitting ? (isLogin ? "Signing in…" : "Working…") : details.action}
      </Button>
    </form>
  );

  if (!isLogin) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted p-4">
        <Card className="w-full max-w-md rounded-2xl border-border/80 shadow-[var(--shadow-card)]">
          <CardHeader className="p-7 sm:p-8">
            <CardTitle>{details.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{details.description}</p>
          </CardHeader>
          <CardContent className="px-7 pb-7 pt-0 sm:px-8 sm:pb-8">{form}</CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-muted lg:h-[100dvh] lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="login-brand-panel relative hidden overflow-hidden px-10 py-10 text-sidebar-foreground lg:flex lg:h-[100dvh] lg:flex-col xl:px-14">
        <OperationalNetwork />
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/branding/default-mark.svg" alt="" width={34} height={34} priority />
          <span className="text-xl font-bold tracking-tight">SaaS App</span>
        </div>
        <div className="relative z-10 my-auto max-w-xl py-16">
          <p className="text-sm font-semibold tracking-[0.16em] text-sidebar-muted uppercase">Operations workspace</p>
          <h1 className="mt-5 max-w-lg text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">Secure operations for modern enterprises</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-sidebar-muted">Manage teams, services, compliance workflows and support operations through one secure workspace.</p>
          <ul className="mt-10 space-y-4 text-sm font-medium">
            {valuePoints.map((point) => <li key={point} className="flex items-center gap-3"><span className="grid size-5 place-items-center rounded-full border border-sidebar-border bg-sidebar-active/50"><Check className="size-3.5" aria-hidden="true" /></span>{point}</li>)}
          </ul>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2 text-xs font-medium text-sidebar-muted"><TrustLabel icon={ShieldCheck} label="SSO Ready" /><TrustLabel icon={BadgeCheck} label="MFA Supported" /><TrustLabel icon={LockKeyhole} label="Role-Based Access" /></div>
      </aside>

      <main className="flex min-h-[100dvh] flex-col bg-muted px-4 py-6 sm:px-8 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:bg-background lg:px-10 lg:py-4 xl:px-16">
        <div className="mx-auto flex w-full max-w-[480px] items-center gap-2 lg:hidden"><Image src="/branding/default-mark.svg" alt="SaaS App" width={28} height={28} priority /><span className="font-bold tracking-tight">SaaS App</span></div>
        <div className="mx-auto flex w-full max-w-[480px] flex-1 items-center py-8 sm:py-12 lg:py-4">
          <Card className="login-form-enter w-full rounded-2xl border-border/80 shadow-[var(--shadow-card)]">
            <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 lg:p-7 lg:pb-0">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl border bg-muted text-primary"><ShieldCheck className="size-5" aria-hidden="true" /></span><div><CardTitle className="text-[28px] leading-8 sm:text-[30px]">{details.title}</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">{details.description}</p></div></div>
            </CardHeader>
            <CardContent className="px-6 pb-7 pt-0 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7">{form}<SecurityFooter /></CardContent>
          </Card>
        </div>
        <footer className="mx-auto flex w-full max-w-[480px] flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Privacy</span><span>Terms</span><span>Help</span><span>System status</span></footer>
      </main>
    </div>
  );
}

function TrustLabel({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border px-2.5 py-1.5"><Icon className="size-3.5" aria-hidden="true" />{label}</span>;
}

function SecurityFooter() {
  return <div className="mt-7 border-t pt-5 text-center lg:mt-5 lg:pt-4"><p className="text-sm font-medium text-muted-foreground">Protected by enterprise-grade authentication</p><div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>MFA supported</span><span aria-hidden="true">•</span><span>Encrypted connection</span><span aria-hidden="true">•</span><span>Role-based access</span></div></div>;
}
