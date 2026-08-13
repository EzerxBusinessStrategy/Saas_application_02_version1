"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
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
import { OperationalNetwork } from "@/components/auth/operational-network";
import { cn } from "@/lib/utils";

/* ─── Schemas ─── */

const emailStepSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your work email.")
    .email("Enter a valid work email."),
});

const passwordStepSchema = z.object({
  password: z.string().min(1, "Enter your password."),
});

const recoverySchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email."),
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

/* ─── Types ─── */

type Mode = "login" | "recovery" | "reset" | "invitation";
type LoginStep = "email" | "password";

type EmailStepValues = { email: string };
type PasswordStepValues = { password: string };
type RecoveryValues = { identifier?: string };
type ResetValues = { password?: string; confirmPassword?: string };

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

/* ─── Main Component ─── */

export function AuthForm({ mode }: { mode: Mode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const isLogin = mode === "login";
  const details = content[mode];

  if (isLogin) {
    return <AuthScreenLayout><LoginForm /></AuthScreenLayout>;
  }

  return <NonLoginForm mode={mode} />;
}

/* ─── Two-Step Login Form ─── */

function LoginForm() {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState<string | undefined>();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isIdentifying, setIsIdentifying] = useState(false);

  /* Step 1: Email form */
  const emailForm = useForm<EmailStepValues>({
    resolver: zodResolver(emailStepSchema) as Resolver<EmailStepValues>,
    defaultValues: { email: "" },
  });

  /* Step 2: Password form */
  const passwordForm = useForm<PasswordStepValues>({
    resolver: zodResolver(passwordStepSchema) as Resolver<PasswordStepValues>,
    defaultValues: { password: "" },
  });

  const onEmailSubmit = async (values: EmailStepValues) => {
    setServerError("");
    setIsIdentifying(true);
    try {
      const response = await fetch("/api/auth/identify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setServerError(
          typeof body?.message === "string"
            ? body.message
            : "Unable to verify this email. Please try again.",
        );
        setIsIdentifying(false);
        return;
      }

      const result = (await response.json()) as {
        method: "password" | "sso";
        displayName?: string;
        provider?: string;
        redirectUrl?: string;
      };

      if (result.method === "sso" && result.redirectUrl) {
        // SSO redirect — navigate directly to the provider
        window.location.assign(result.redirectUrl);
        return;
      }

      // Password method
      setEmail(values.email);
      setDisplayName(result.displayName);
      setStep("password");
      setIsIdentifying(false);
    } catch {
      setServerError("Unable to connect. Check your network and try again.");
      setIsIdentifying(false);
    }
  };

  const onPasswordSubmit = async (values: PasswordStepValues) => {
    setServerError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password: values.password,
          rememberMe: false,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setServerError(
          data?.message ?? "Invalid email or password. Please try again.",
        );
        return;
      }

      const { redirect } = (await response.json()) as { redirect: string };
      window.location.assign(redirect);
    } catch {
      setServerError("Unable to sign in right now. Check your connection and try again.");
    }
  };

  const goBackToEmail = () => {
    setStep("email");
    setServerError("");
    passwordForm.reset();
  };

  /* ─── Step 1: Email ─── */
  if (step === "email") {
    return (
      <>
        <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 lg:p-7 lg:pb-0">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border bg-muted text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-[28px] leading-8 sm:text-[30px]">
                {content.login.title}
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {content.login.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-7 pt-0 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7">
          <form
            className="mt-7 flex flex-col gap-5 lg:mt-5 lg:gap-4"
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            noValidate
          >
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Work email
              <Input
                type="email"
                required
                data-field-label="Work email"
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(emailForm.formState.errors.email)}
                aria-describedby={
                  emailForm.formState.errors.email
                    ? "auth-email-error"
                    : undefined
                }
                className="h-12 rounded-lg px-3.5 lg:h-11"
                {...emailForm.register("email")}
              />
              {emailForm.formState.errors.email ? (
                <span
                  id="auth-email-error"
                  className="text-sm font-normal text-danger"
                  role="alert"
                >
                  {emailForm.formState.errors.email.message}
                </span>
              ) : null}
            </label>

            {serverError ? (
              <p
                className="rounded-lg border border-danger/25 bg-[var(--chip-danger-bg)] p-3 text-sm text-danger"
                role="alert"
              >
                {serverError}
              </p>
            ) : null}

            <Button
              className="h-12 w-full rounded-lg text-[15px] font-semibold shadow-sm active:translate-y-px lg:h-11"
              type="submit"
              disabled={isIdentifying || emailForm.formState.isSubmitting}
            >
              {isIdentifying ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {isIdentifying ? "Verifying…" : "Continue"}
            </Button>
          </form>
          <SecurityFooter />
        </CardContent>
      </>
    );
  }

  /* ─── Step 2: Password ─── */
  return (
    <>
      <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 lg:p-7 lg:pb-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBackToEmail}
            className="grid size-9 place-items-center rounded-xl border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to email"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <div>
            <CardTitle className="text-[28px] leading-8 sm:text-[30px]">
              {displayName ? `Welcome back, ${displayName}` : "Sign in"}
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {email}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-7 pt-0 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7">
        <form
          className="mt-7 flex flex-col gap-5 lg:mt-5 lg:gap-4"
          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
          noValidate
        >
          <div className="flex flex-col gap-2 text-sm font-semibold">
            <label htmlFor="auth-password">Password <span data-required-marker aria-hidden="true">*</span></label>
            <span className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                data-field-label="Password"
                autoComplete="current-password"
                autoFocus
                className="h-12 rounded-lg px-3.5 pr-11 lg:h-11"
                aria-invalid={Boolean(passwordForm.formState.errors.password)}
                aria-describedby={
                  passwordForm.formState.errors.password
                    ? "auth-password-error"
                    : undefined
                }
                {...passwordForm.register("password")}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </span>
            {passwordForm.formState.errors.password ? (
              <span
                id="auth-password-error"
                className="text-sm font-normal text-danger"
                role="alert"
              >
                {passwordForm.formState.errors.password.message}
              </span>
            ) : null}
          </div>

          {serverError ? (
            <p
              className="rounded-lg border border-danger/25 bg-[var(--chip-danger-bg)] p-3 text-sm text-danger"
              role="alert"
            >
              {serverError}
            </p>
          ) : null}

          <Button
            className="h-12 w-full rounded-lg text-[15px] font-semibold shadow-sm active:translate-y-px lg:h-11"
            type="submit"
            disabled={passwordForm.formState.isSubmitting}
          >
            {passwordForm.formState.isSubmitting ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <LockKeyhole className="size-4" aria-hidden="true" />
            )}
            {passwordForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* SSO Buttons (structurally present, disabled until configured) */}
          <Button
            type="button"
            variant="outline"
            disabled
            className="h-12 w-full rounded-lg text-sm font-medium lg:h-11"
            title="Microsoft SSO will be available soon"
          >
            <svg className="mr-2 size-4" viewBox="0 0 21 21" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Continue with Microsoft
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled
            className="h-12 w-full rounded-lg text-sm font-medium lg:h-11"
            title="Google SSO will be available soon"
          >
            <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center justify-center">
            <Link
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
        </form>
        <SecurityFooter />
      </CardContent>
    </>
  );
}

/* ─── Non-Login Form (Recovery / Reset / Invitation) ─── */

function NonLoginForm({ mode }: { mode: Exclude<Mode, "login"> }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const details = content[mode];
  const isPasswordMode = mode === "reset" || mode === "invitation";

  const schema = mode === "recovery" ? recoverySchema : passwordSchema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema) as Resolver<RecoveryValues & ResetValues>,
    defaultValues: {
      identifier: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async () => {
    setServerError("");
    try {
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
      {mode === "recovery" ? (
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Email
          <Input
            type="email"
            required
            data-field-label="Email"
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

      {isPasswordMode ? (
        <>
          <div className="flex flex-col gap-2 text-sm font-semibold">
            <label htmlFor="auth-password">Password <span data-required-marker aria-hidden="true">*</span></label>
            <span className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                data-field-label="Password"
                autoComplete="new-password"
                className="h-12 rounded-lg px-3.5 pr-11 lg:h-11"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "auth-password-error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
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

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Confirm password <span data-required-marker aria-hidden="true">*</span>
            <Input
              type={showPassword ? "text" : "password"}
              required
              data-field-label="Confirm password"
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
        </>
      ) : null}

      {serverError ? (
        <p className="rounded-lg border border-danger/25 bg-[var(--chip-danger-bg)] p-3 text-sm text-danger" role="alert">
          {serverError}
        </p>
      ) : null}

      <Button className="h-12 w-full rounded-lg text-[15px] font-semibold shadow-sm active:translate-y-px lg:h-11" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LockKeyhole className="size-4" aria-hidden="true" />}
        {isSubmitting ? "Working…" : details.action}
      </Button>
    </form>
  );

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

/* ─── Login Layout (two-panel) ─── */

export function AuthScreenLayout({
  children,
  cardClassName,
}: {
  children: React.ReactNode;
  cardClassName?: string;
}) {
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

      <main className="auth-right-panel flex min-h-[100dvh] flex-col bg-[#f8f9ff] px-4 py-6 sm:px-8 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:px-10 lg:py-4 xl:px-16">
        <div className="mx-auto flex w-full max-w-[480px] items-center gap-2 lg:hidden"><Image src="/branding/default-mark.svg" alt="SaaS App" width={28} height={28} priority /><span className="font-bold tracking-tight">SaaS App</span></div>
        <div className="mx-auto flex w-full max-w-[480px] flex-1 items-center py-8 sm:py-12 lg:py-4">
          <Card className={cn("login-form-enter w-full rounded-2xl border-border/80 shadow-[var(--shadow-card)]", cardClassName)}>
            {children}
          </Card>
        </div>
        <footer className="relative mx-auto flex w-full max-w-[480px] flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[#687899]"><span>Privacy</span><span>Terms</span><span>Help</span><span>System status</span><span className="size-1.5 self-center rounded-full bg-emerald-500" aria-label="System operational" /></footer>
      </main>
    </div>
  );
}

/* ─── Small Components ─── */

function TrustLabel({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border px-2.5 py-1.5"><Icon className="size-3.5" aria-hidden="true" />{label}</span>;
}

function SecurityFooter() {
  return <div className="mt-7 border-t pt-5 text-center lg:mt-5 lg:pt-4"><p className="text-sm font-medium text-muted-foreground">Protected by enterprise-grade authentication</p><div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>MFA supported</span><span aria-hidden="true">•</span><span>Encrypted connection</span><span aria-hidden="true">•</span><span>Role-based access</span></div></div>;
}
