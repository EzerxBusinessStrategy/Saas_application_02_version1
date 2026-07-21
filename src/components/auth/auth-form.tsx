"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const schemas = {
  login: z.object({
    email: z.string().email("Enter a valid work email."),
    password: z.string().min(8, "Password must contain at least 8 characters."),
  }),
  recovery: z.object({ email: z.string().email("Enter a valid work email.") }),
  password: z
    .object({
      password: z
        .string()
        .min(8, "Password must contain at least 8 characters."),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    }),
};

type Mode = "login" | "recovery" | "reset" | "invitation";
type Values = { email?: string; password?: string; confirmPassword?: string };
const content: Record<
  Mode,
  { title: string; description: string; action: string }
> = {
  login: {
    title: "Sign in to Acme Ops",
    description: "Use your company account to continue.",
    action: "Sign in",
  },
  recovery: {
    title: "Reset your password",
    description: "We will send a secure reset link to your work email.",
    action: "Send reset link",
  },
  reset: {
    title: "Choose a new password",
    description:
      "Use at least 8 characters and keep it unique to your account.",
    action: "Save new password",
  },
  invitation: {
    title: "Accept your invitation",
    description: "Set a password to activate your Acme Ops account.",
    action: "Activate account",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const schema =
    mode === "login"
      ? schemas.login
      : mode === "recovery"
        ? schemas.recovery
        : schemas.password;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });
  const details = content[mode];
  const onSubmit = async () => {
    setSubmitted(true);
  };
  const passwordMode =
    mode === "login" || mode === "reset" || mode === "invitation";

  return (
    <main className="grid min-h-screen place-items-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{details.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{details.description}</p>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <p
              className="rounded-[var(--radius-control)] bg-success/10 p-3 text-sm text-success"
              role="status"
            >
              {mode === "recovery"
                ? "If this address belongs to an account, a reset link will be sent."
                : "Your request is ready for the authentication service to complete."}
            </p>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              {mode !== "reset" && mode !== "invitation" ? (
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Work email
                  <Input
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    {...register("email")}
                  />
                  {errors.email ? (
                    <span className="text-sm text-danger">
                      {errors.email.message}
                    </span>
                  ) : null}
                </label>
              ) : null}
              {passwordMode ? (
                <>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Password
                    <span className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        className="pr-10"
                        aria-invalid={Boolean(errors.password)}
                        {...register("password")}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </span>
                    {errors.password ? (
                      <span className="text-sm text-danger">
                        {errors.password.message}
                      </span>
                    ) : null}
                  </label>
                  {mode !== "login" ? (
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      Confirm password
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.confirmPassword)}
                        {...register("confirmPassword")}
                      />
                      {errors.confirmPassword ? (
                        <span className="text-sm text-danger">
                          {errors.confirmPassword.message}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                </>
              ) : null}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Working…" : details.action}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
