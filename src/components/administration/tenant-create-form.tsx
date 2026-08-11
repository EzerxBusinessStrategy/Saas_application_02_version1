"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createTenant,
  getTenantAdminEmailAvailability,
  getTenantCreationOptions,
} from "@/features/administration/api/administration-api";
import {
  createTenantSchema,
  type CreateTenantInput,
} from "@/types/administration";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TenantCreateLoader } from "@/components/shared/tenant-create-loader";

const steps = [
  "Company details",
  "Financial setup",
  "Tenant Administrator",
  "Review and create",
] as const;

const defaultValues: CreateTenantInput = {
  company: {
    displayName: "",
    legalName: "",
    tenantCode: "",
    slug: "",
    countryCode: "IN",
    reportingCurrencyCode: "INR",
    timezone: "Asia/Kolkata",
    industry: "",
    incorporationDate: "",
    registrationNumber: "",
    taxIdentifier: "",
  },
  financialYear: {
    source: "COUNTRY_SUGGESTION_CONFIRMED",
    label: "",
    startsOn: "",
    endsOn: "",
    templateId: "",
    overrideReason: "",
  },
  tenantAdministrator: {
    fullName: "",
    email: "",
    password: "",
    phone: "",
  },
  confirm: false,
};

export function TenantCreatePageForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [continuePending, setContinuePending] = useState(false);
  const form = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues,
    mode: "onBlur",
  });
  const countryCode = form.watch("company.countryCode");
  const incorporationDate = form.watch("company.incorporationDate");
  const fySource = form.watch("financialYear.source");
  const adminEmail = form.watch("tenantAdministrator.email");
  const normalizedAdminEmail = adminEmail.trim().toLowerCase();
  const adminEmailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAdminEmail);
  const [emailToCheck, setEmailToCheck] = useState("");

  const options = useQuery({
    queryKey: ["tenant-creation-options", countryCode, incorporationDate],
    queryFn: () => getTenantCreationOptions(countryCode, incorporationDate || undefined),
  });

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: (created) => router.replace(`/super-admin/tenants/${created.tenantId}`),
  });
  const emailAvailability = useQuery({
    queryKey: ["tenant-admin-email-availability", emailToCheck],
    queryFn: () => getTenantAdminEmailAvailability(emailToCheck),
    enabled: Boolean(emailToCheck),
    staleTime: 30_000,
  });
  const emailUnavailable = emailToCheck === normalizedAdminEmail && emailAvailability.data?.available === false;
  const emailCheckPending =
    adminEmailLooksValid &&
    (emailToCheck !== normalizedAdminEmail || emailAvailability.isFetching);
  const blockCreate = mutation.isPending || emailUnavailable || emailCheckPending;
  const blockContinue = step === 2 && (emailUnavailable || emailCheckPending);

  // Track previous countryCode so we can detect changes
  const prevCountryRef = useRef(countryCode);

  useEffect(() => {
    const countryChanged = prevCountryRef.current !== countryCode;
    prevCountryRef.current = countryCode;

    if (!options.data) return;

    // Always update currency and timezone from the selected country
    const country = options.data.countries.find((item) => item.countryCode === countryCode);
    if (country) {
      form.setValue("company.reportingCurrencyCode", country.reportingCurrencyCode);
      form.setValue("company.timezone", country.timezone);
    }

    // When country changes, reset the financial year fields
    if (countryChanged) {
      form.setValue("financialYear.source", "COUNTRY_SUGGESTION_CONFIRMED");
      form.setValue("financialYear.label", "");
      form.setValue("financialYear.startsOn", "");
      form.setValue("financialYear.endsOn", "");
      form.setValue("financialYear.templateId", "");
      form.setValue("financialYear.overrideReason", "");
    }

    // Auto-fill suggested financial year when available and source is COUNTRY_SUGGESTION
    if (options.data.suggestedFinancialYear && fySource === "COUNTRY_SUGGESTION_CONFIRMED") {
      form.setValue("financialYear.templateId", options.data.suggestedFinancialYear.id);
      form.setValue("financialYear.label", options.data.suggestedFinancialYear.label);
      form.setValue("financialYear.startsOn", options.data.suggestedFinancialYear.startsOn);
      form.setValue("financialYear.endsOn", options.data.suggestedFinancialYear.endsOn);
    }
  }, [countryCode, incorporationDate, form, fySource, options.data]);

  const displayName = form.watch("company.displayName");
  useEffect(() => {
    const slug = slugify(displayName);
    if (!slug) return;
    if (!form.getValues("company.slug")) form.setValue("company.slug", slug);
    if (!form.getValues("company.tenantCode")) form.setValue("company.tenantCode", codeFromName(displayName));
  }, [displayName, form]);

  useEffect(() => {
    if (!adminEmailLooksValid) {
      setEmailToCheck("");
      return;
    }
    const timeout = window.setTimeout(() => setEmailToCheck(normalizedAdminEmail), 500);
    return () => window.clearTimeout(timeout);
  }, [adminEmailLooksValid, normalizedAdminEmail]);

  useEffect(() => {
    const emailError = form.formState.errors.tenantAdministrator?.email;
    if (emailUnavailable) {
      form.setError("tenantAdministrator.email", {
        type: "manual",
        message: "Email already exists. This email is already associated with an existing user or tenant. Please provide a unique email address for the new Tenant Admin.",
      });
    } else if (emailError?.type === "manual") {
      form.clearErrors("tenantAdministrator.email");
    }
  }, [emailUnavailable, form, form.formState.errors.tenantAdministrator?.email]);

  const fieldGroups = useMemo(
    () => [
      [
        "company.displayName",
        "company.legalName",
        "company.tenantCode",
        "company.slug",
        "company.countryCode",
        "company.reportingCurrencyCode",
        "company.timezone",
      ],
      [
        "financialYear.source",
        "financialYear.label",
        "financialYear.startsOn",
        "financialYear.endsOn",
      ],
      ["tenantAdministrator.fullName", "tenantAdministrator.email", "tenantAdministrator.password", "tenantAdministrator.phone"],
      ["tenantAdministrator.email", "tenantAdministrator.password", "tenantAdministrator.phone", "confirm"],
    ],
    [],
  );

  async function continueStep() {
    if (continuePending) return;
    setContinuePending(true);
    try {
      const valid = await form.trigger(fieldGroups[step] as Parameters<typeof form.trigger>[0]);
      if (step === 2 && (emailUnavailable || emailCheckPending)) return;
      if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
    } finally {
      setContinuePending(false);
    }
  }

  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Platform > Tenants > Create tenant"
        eyebrowIcon={ShieldCheck}
        title="Create tenant"
        description="Set up the company, financial year and first Tenant Administrator."
        actions={
          <div className="flex gap-3">
            <Link href="/super-admin/tenants" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            {step < steps.length - 1 ? (
              <div className="flex items-center gap-2">
                {continuePending ? <TenantCreateLoader /> : null}
                <Button type="button" onClick={continueStep} disabled={blockContinue || continuePending}>
                  Save and continue
                </Button>
              </div>
            ) : (
              <Button type="submit" form="create-tenant-form" disabled={blockCreate}>
                {mutation.isPending ? "Creating..." : "Create tenant and administrator account"}
              </Button>
            )}
          </div>
        }
      />
      <ol className="grid gap-3 md:grid-cols-4" aria-label="Create tenant steps">
        {steps.map((label, index) => (
          <li
            key={label}
            className={`rounded-md border px-4 py-3 text-sm ${index === step ? "border-primary bg-primary/5 font-semibold" : "text-muted-foreground"
              }`}
          >
            <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border text-xs">
              {index < step ? <Check className="size-3" /> : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <form
        id="create-tenant-form"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (!blockCreate) mutation.mutate(values);
        })}
      >
        {step === 0 ? (
          <CompanyStep
            form={form}
            countries={options.data?.countries ?? []}
            isLoadingCountries={options.isLoading}
          />
        ) : null}
        {step === 1 ? (
          <FinancialStep form={form} options={options.data} isLoading={options.isLoading} />
        ) : null}
        {step === 2 ? <AdminStep form={form} isCheckingEmail={emailCheckPending} /> : null}
        {step === 3 ? <ReviewStep form={form} error={mutation.error?.message} /> : null}
      </form>
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || mutation.isPending}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          Back
        </Button>
        {step < steps.length - 1 ? (
          <div className="flex items-center gap-2">
            {continuePending ? <TenantCreateLoader /> : null}
            <Button type="button" onClick={continueStep} disabled={blockContinue || continuePending}>
              Save and continue
            </Button>
          </div>
        ) : (
          <Button type="submit" form="create-tenant-form" disabled={blockCreate}>
            {mutation.isPending ? "Creating..." : "Create tenant and administrator account"}
          </Button>
        )}
      </div>
    </div>
  );
}

function CompanyStep({
  form,
  countries,
  isLoadingCountries,
}: {
  form: ReturnType<typeof useForm<CreateTenantInput>>;
  countries: NonNullable<Awaited<ReturnType<typeof getTenantCreationOptions>>["countries"]>;
  isLoadingCountries: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field label="Company display name" error={form.formState.errors.company?.displayName?.message}>
          <Input {...form.register("company.displayName")} />
        </Field>
        <Field label="Legal company name" error={form.formState.errors.company?.legalName?.message}>
          <Input {...form.register("company.legalName")} />
        </Field>
        <Field label="Tenant code" error={form.formState.errors.company?.tenantCode?.message}>
          <Input {...form.register("company.tenantCode")} />
        </Field>
        <Field label="URL slug" error={form.formState.errors.company?.slug?.message}>
          <Input {...form.register("company.slug")} />
        </Field>
        <Field label="Country" error={form.formState.errors.company?.countryCode?.message}>
          <Select 
            {...form.register("company.countryCode")} 
            value={form.watch("company.countryCode")}
            disabled={isLoadingCountries}
          >
            {countries.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Reporting currency"
          hint="Auto-filled from country"
          error={form.formState.errors.company?.reportingCurrencyCode?.message}
        >
          <Input readOnly {...form.register("company.reportingCurrencyCode")} />
        </Field>
        <Field
          label="Accounting timezone"
          hint="Auto-filled from country"
          error={form.formState.errors.company?.timezone?.message}
        >
          <Input readOnly {...form.register("company.timezone")} />
        </Field>
        <Field label="Industry">
          <Input {...form.register("company.industry")} placeholder="e.g. Technology" />
        </Field>
        <Field label="Incorporation date" hint="Required for UK companies">
          <Input type="date" {...form.register("company.incorporationDate")} />
        </Field>
        <Field label="Company registration number">
          <Input {...form.register("company.registrationNumber")} />
        </Field>
        <Field label="Tax / GST / VAT number">
          <Input {...form.register("company.taxIdentifier")} />
        </Field>
      </CardContent>
    </Card>
  );
}

function FinancialStep({
  form,
  options,
  isLoading,
}: {
  form: ReturnType<typeof useForm<CreateTenantInput>>;
  options: Awaited<ReturnType<typeof getTenantCreationOptions>> | undefined;
  isLoading: boolean;
}) {
  const source = form.watch("financialYear.source");
  const suggested = options?.suggestedFinancialYear;
  const policyMode = options?.policyMode;
  const isIncorporationDerived = policyMode === "INCORPORATION_DERIVED";
  const isCustomOnly = policyMode === "COMPANY_DEFINED" && !suggested;

  // When switching to CUSTOM_CONFIRMED, clear auto-filled fields so user fills them
  useEffect(() => {
    if (source === "CUSTOM_CONFIRMED") {
      form.setValue("financialYear.templateId", "");
      form.setValue("financialYear.label", "");
      form.setValue("financialYear.startsOn", "");
      form.setValue("financialYear.endsOn", "");
    } else if (source === "COUNTRY_SUGGESTION_CONFIRMED" && suggested) {
      form.setValue("financialYear.templateId", suggested.id);
      form.setValue("financialYear.label", suggested.label);
      form.setValue("financialYear.startsOn", suggested.startsOn);
      form.setValue("financialYear.endsOn", suggested.endsOn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial setup</CardTitle>
        <CardDescription>
          Confirm the authoritative financial year saved for this tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading country policy...</p>
        ) : null}
        {options?.guidance ? (
          <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {options.guidance}
          </p>
        ) : null}

        {/* INCORPORATION_DERIVED — warn the user they need an incorporation date */}
        {isIncorporationDerived && !suggested ? (
          <p className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
            Enter the incorporation date on the Company details step to generate the suggested financial year end.
          </p>
        ) : null}

        {/* Only show suggestion radio if we have a suggestion */}
        {suggested ? (
          <label className="rounded-md border p-4">
            <span className="flex items-start gap-3">
              <input
                type="radio"
                value="COUNTRY_SUGGESTION_CONFIRMED"
                {...form.register("financialYear.source")}
              />
              <span>
                <span className="block font-medium">Use suggested financial year</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {`${suggested.label}: ${suggested.startsOn} to ${suggested.endsOn}`}
                </span>
              </span>
            </span>
          </label>
        ) : null}

        {/* Custom option — always visible */}
        <label className="rounded-md border p-4">
          <span className="flex items-start gap-3">
            <input
              type="radio"
              value="CUSTOM_CONFIRMED"
              {...form.register("financialYear.source")}
            />
            <span>
              <span className="block font-medium">
                {isCustomOnly ? "Enter company financial year" : "Use custom financial year"}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {isCustomOnly
                  ? "This country allows the company to choose its own financial year end."
                  : "Requires company confirmation and a reason."}
              </span>
            </span>
          </span>
        </label>

        {/* Suggested year end hints for COMPANY_DEFINED */}
        {options?.suggestedYearEnds && options.suggestedYearEnds.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Common year-end dates: {options.suggestedYearEnds.join(", ")}
          </p>
        ) : null}

        <div className="grid gap-5 md:grid-cols-3">
          <Field
            label="Financial-year label"
            error={form.formState.errors.financialYear?.label?.message}
          >
            <Input
              readOnly={source === "COUNTRY_SUGGESTION_CONFIRMED"}
              placeholder="e.g. FY 2026-27"
              {...form.register("financialYear.label")}
            />
          </Field>
          <Field
            label="Start date"
            error={form.formState.errors.financialYear?.startsOn?.message}
          >
            <Input
              type="date"
              readOnly={source === "COUNTRY_SUGGESTION_CONFIRMED"}
              {...form.register("financialYear.startsOn")}
            />
          </Field>
          <Field
            label="End date"
            error={form.formState.errors.financialYear?.endsOn?.message}
          >
            <Input
              type="date"
              readOnly={source === "COUNTRY_SUGGESTION_CONFIRMED"}
              {...form.register("financialYear.endsOn")}
            />
          </Field>
        </div>

        {source === "CUSTOM_CONFIRMED" ? (
          <Field
            label="Reason for custom period"
            error={form.formState.errors.financialYear?.overrideReason?.message}
          >
            <Input
              {...form.register("financialYear.overrideReason")}
              placeholder="Briefly explain why a custom period is needed"
            />
          </Field>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AdminStep({
  form,
  isCheckingEmail,
}: {
  form: ReturnType<typeof useForm<CreateTenantInput>>;
  isCheckingEmail: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenant Administrator</CardTitle>
        <CardDescription>
          Create the Tenant Administrator sign-in account. No invitation email is sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field
          label="Full name"
          error={form.formState.errors.tenantAdministrator?.fullName?.message}
        >
          <Input {...form.register("tenantAdministrator.fullName")} />
        </Field>
        <Field
          label="Work email"
          hint={isCheckingEmail ? "Checking availability" : undefined}
          error={form.formState.errors.tenantAdministrator?.email?.message}
        >
          <Input type="email" {...form.register("tenantAdministrator.email")} />
        </Field>
        <Field
          label="Initial password"
          error={form.formState.errors.tenantAdministrator?.password?.message}
        >
          <PasswordInput {...form.register("tenantAdministrator.password")} />
        </Field>
        <Field label="Phone number" error={form.formState.errors.tenantAdministrator?.phone?.message}>
          <Input type="tel" autoComplete="tel" {...form.register("tenantAdministrator.phone")} />
        </Field>
        <Field label="Role">
          <Input readOnly value="Tenant Administrator" />
        </Field>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  form,
  error,
}: {
  form: ReturnType<typeof useForm<CreateTenantInput>>;
  error?: string;
}) {
  const values = form.watch();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review and create</CardTitle>
        <CardDescription>Confirm the tenant before creating it in PostgreSQL.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid gap-4 text-sm md:grid-cols-3">
          <Summary
            label="Company"
            value={`${values.company.legalName || "-"} · ${values.company.countryCode} · ${values.company.reportingCurrencyCode}`}
          />
          <Summary
            label="Financial year"
            value={`${values.financialYear.label || "-"} · ${values.financialYear.startsOn || "-"} to ${values.financialYear.endsOn || "-"}`}
          />
          <Summary
            label="Tenant Administrator"
            value={`${values.tenantAdministrator.fullName || "-"} · ${values.tenantAdministrator.email || "-"}`}
          />
        </dl>
        <Field
          label="Tenant Administrator email"
          error={form.formState.errors.tenantAdministrator?.email?.message}
        >
          <Input type="email" {...form.register("tenantAdministrator.email")} />
        </Field>
        <Field label="Temporary password" error={form.formState.errors.tenantAdministrator?.password?.message}>
          <PasswordInput {...form.register("tenantAdministrator.password")} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" {...form.register("confirm")} />
          <span>
            I confirm these company, financial-year and Tenant Administrator details are correct.
          </span>
        </label>
        {form.formState.errors.confirm ? (
          <p className="text-sm text-danger">{form.formState.errors.confirm.message}</p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} autoComplete="new-password" className="pr-11" />
      <button
        type="button"
        className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      <span>
        {label}
        {hint ? <span className="ml-1 text-xs font-normal text-muted-foreground">({hint})</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function codeFromName(value: string) {
  return `${value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "TEN"}001`;
}
