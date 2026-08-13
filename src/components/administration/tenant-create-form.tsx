"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
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
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
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
    placeholderData: (previousData) => previousData,
  });
  const selectedOptions = options.data?.countryCode === countryCode ? options.data : undefined;
  const selectedCountry = selectedOptions?.countries.find((country) => country.countryCode === countryCode);

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

    // Clear the previous country's financial year before the new policy loads.
    if (countryChanged) {
      form.setValue("financialYear.source", "COUNTRY_SUGGESTION_CONFIRMED");
      form.setValue("financialYear.label", "");
      form.setValue("financialYear.startsOn", "");
      form.setValue("financialYear.endsOn", "");
      form.setValue("financialYear.templateId", "");
      form.setValue("financialYear.overrideReason", "");
      if (countryCode !== "GB") form.clearErrors("company.incorporationDate");
    }

    if (!selectedOptions) return;

    // Always update currency and timezone from the selected country
    const country = selectedOptions.countries.find((item) => item.countryCode === countryCode);
    if (country) {
      form.setValue("company.reportingCurrencyCode", country.reportingCurrencyCode);
      form.setValue("company.timezone", country.timezone);
    }

    // Auto-fill suggested financial year when available and source is COUNTRY_SUGGESTION
    if (selectedOptions.suggestedFinancialYear && fySource === "COUNTRY_SUGGESTION_CONFIRMED") {
      form.setValue("financialYear.templateId", selectedOptions.suggestedFinancialYear.id);
      form.setValue("financialYear.label", selectedOptions.suggestedFinancialYear.label);
      form.setValue("financialYear.startsOn", selectedOptions.suggestedFinancialYear.startsOn);
      form.setValue("financialYear.endsOn", selectedOptions.suggestedFinancialYear.endsOn);
    }
  }, [countryCode, incorporationDate, form, fySource, selectedOptions]);

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
        "company.incorporationDate",
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
      const valid = await form.trigger(
        fieldGroups[step] as Parameters<typeof form.trigger>[0],
        { shouldFocus: true },
      );
      if (step === 2 && (emailUnavailable || emailCheckPending)) return;
      if (!valid) {
        setValidationMessage("Complete the highlighted required fields before continuing.");
        return;
      }
      setValidationMessage(null);
      setStep((current) => Math.min(current + 1, steps.length - 1));
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
        onSubmit={form.handleSubmit(
          (values) => {
            setValidationMessage(null);
            if (!blockCreate) mutation.mutate(values);
          },
          () => setValidationMessage("Complete the highlighted required fields before creating the tenant."),
        )}
      >
        {validationMessage ? (
          <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">
            {validationMessage}
          </p>
        ) : null}
        {step === 0 ? (
          <CompanyStep
            form={form}
            countries={options.data?.countries ?? []}
            isLoadingCountries={options.isFetching}
            selectedCountryName={selectedCountry?.name}
            policyMode={selectedOptions?.policyMode}
            incorporationDateRequired={countryCode === "GB"}
          />
        ) : null}
        {step === 1 ? (
          <FinancialStep
            form={form}
            options={selectedOptions}
            isLoading={options.isLoading}
            countryName={selectedCountry?.name ?? countryCode}
          />
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
  selectedCountryName,
  policyMode,
  incorporationDateRequired,
}: {
  form: ReturnType<typeof useForm<CreateTenantInput>>;
  countries: NonNullable<Awaited<ReturnType<typeof getTenantCreationOptions>>["countries"]>;
  isLoadingCountries: boolean;
  selectedCountryName?: string;
  policyMode?: string;
  incorporationDateRequired: boolean;
}) {
  const incorporationHint =
    policyMode === "INCORPORATION_DERIVED"
      ? `Required to calculate the first financial year for ${selectedCountryName ?? "this country"}`
      : selectedCountryName
        ? `Optional for ${selectedCountryName}; the financial year follows its country policy`
        : "Select a country to load its incorporation requirements";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field label="Company display name" required error={form.formState.errors.company?.displayName?.message}>
          <Input required aria-label="Company display name" aria-invalid={Boolean(form.formState.errors.company?.displayName)} data-field-label="Company display name" {...form.register("company.displayName")} />
        </Field>
        <Field label="Legal company name" required error={form.formState.errors.company?.legalName?.message}>
          <Input required aria-label="Legal company name" aria-invalid={Boolean(form.formState.errors.company?.legalName)} data-field-label="Legal company name" {...form.register("company.legalName")} />
        </Field>
        <Field label="Tenant code" required error={form.formState.errors.company?.tenantCode?.message}>
          <Input required aria-label="Tenant code" aria-invalid={Boolean(form.formState.errors.company?.tenantCode)} data-field-label="Tenant code" {...form.register("company.tenantCode")} />
        </Field>
        <Field label="URL slug" required error={form.formState.errors.company?.slug?.message}>
          <Input required aria-label="URL slug" aria-invalid={Boolean(form.formState.errors.company?.slug)} data-field-label="URL slug" {...form.register("company.slug")} />
        </Field>
        <Field label="Country" required error={form.formState.errors.company?.countryCode?.message}>
          <div className="relative">
            <Select
              {...form.register("company.countryCode")}
              required
              aria-label="Country"
              data-field-label="Country"
              className="pr-10"
              value={form.watch("company.countryCode")}
              disabled={isLoadingCountries}
              aria-busy={isLoadingCountries}
              aria-invalid={Boolean(form.formState.errors.company?.countryCode)}
            >
              {!countries.length ? (
                <option value={form.watch("company.countryCode")}>Loading countries...</option>
              ) : null}
              {countries.map((country) => (
                <option key={country.countryCode} value={country.countryCode}>
                  {country.name}
                </option>
              ))}
            </Select>
            {isLoadingCountries ? (
              <span
                className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-primary"
                role="status"
                aria-label="Loading country details"
              >
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </Field>
        <Field
          label="Reporting currency"
          required
          hint="Auto-filled from country"
          error={form.formState.errors.company?.reportingCurrencyCode?.message}
        >
          <Input readOnly aria-label="Reporting currency" aria-invalid={Boolean(form.formState.errors.company?.reportingCurrencyCode)} {...form.register("company.reportingCurrencyCode")} />
        </Field>
        <Field
          label="Accounting timezone"
          required
          hint="Auto-filled from country"
          error={form.formState.errors.company?.timezone?.message}
        >
          <Input readOnly aria-label="Accounting timezone" aria-invalid={Boolean(form.formState.errors.company?.timezone)} {...form.register("company.timezone")} />
        </Field>
        <Field label="Industry">
          <Input {...form.register("company.industry")} placeholder="e.g. Technology" />
        </Field>
        <Field
          label="Incorporation date"
          hint={incorporationHint}
          required={incorporationDateRequired}
          error={form.formState.errors.company?.incorporationDate?.message}
        >
          <Input
            type="date"
            required={incorporationDateRequired}
            aria-label="Incorporation date"
            aria-invalid={Boolean(form.formState.errors.company?.incorporationDate)}
            className={form.formState.errors.company?.incorporationDate ? "border-danger focus-visible:ring-danger" : undefined}
            {...form.register("company.incorporationDate")}
          />
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
  countryName,
}: {
  form: ReturnType<typeof useForm<CreateTenantInput>>;
  options: Awaited<ReturnType<typeof getTenantCreationOptions>> | undefined;
  isLoading: boolean;
  countryName: string;
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
        <CardTitle>Financial setup for {countryName}</CardTitle>
        <CardDescription>
          Confirm the authoritative financial year saved for this {countryName} tenant.
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
            Enter the {countryName} incorporation date on the Company details step to generate the suggested financial year end.
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
                <span className="block font-medium">Use suggested {countryName} financial year</span>
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
            required
            error={form.formState.errors.financialYear?.label?.message}
          >
            <Input
              readOnly={source === "COUNTRY_SUGGESTION_CONFIRMED"}
              required={source === "CUSTOM_CONFIRMED"}
              aria-label="Financial-year label"
              aria-invalid={Boolean(form.formState.errors.financialYear?.label)}
              data-field-label="Financial-year label"
              placeholder="e.g. FY 2026-27"
              {...form.register("financialYear.label")}
            />
          </Field>
          <Field
            label="Start date"
            required
            error={form.formState.errors.financialYear?.startsOn?.message}
          >
            <Input
              type="date"
              readOnly={source === "COUNTRY_SUGGESTION_CONFIRMED"}
              required={source === "CUSTOM_CONFIRMED"}
              aria-label="Start date"
              aria-invalid={Boolean(form.formState.errors.financialYear?.startsOn)}
              data-field-label="Start date"
              {...form.register("financialYear.startsOn")}
            />
          </Field>
          <Field
            label="End date"
            required
            error={form.formState.errors.financialYear?.endsOn?.message}
          >
            <Input
              type="date"
              readOnly={source === "COUNTRY_SUGGESTION_CONFIRMED"}
              required={source === "CUSTOM_CONFIRMED"}
              aria-label="End date"
              aria-invalid={Boolean(form.formState.errors.financialYear?.endsOn)}
              data-field-label="End date"
              {...form.register("financialYear.endsOn")}
            />
          </Field>
        </div>

        {source === "CUSTOM_CONFIRMED" ? (
          <Field
            label="Reason for custom period"
            required
            error={form.formState.errors.financialYear?.overrideReason?.message}
          >
            <Input
              {...form.register("financialYear.overrideReason")}
              required
              aria-label="Reason for custom period"
              aria-invalid={Boolean(form.formState.errors.financialYear?.overrideReason)}
              data-field-label="Reason for custom period"
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
          required
          error={form.formState.errors.tenantAdministrator?.fullName?.message}
        >
          <Input required aria-label="Full name" aria-invalid={Boolean(form.formState.errors.tenantAdministrator?.fullName)} data-field-label="Full name" {...form.register("tenantAdministrator.fullName")} />
        </Field>
        <Field
          label="Work email"
          required
          hint={isCheckingEmail ? "Checking availability" : undefined}
          error={form.formState.errors.tenantAdministrator?.email?.message}
        >
          <Input required aria-label="Work email" aria-invalid={Boolean(form.formState.errors.tenantAdministrator?.email)} data-field-label="Work email" type="email" {...form.register("tenantAdministrator.email")} />
        </Field>
        <Field
          label="Initial password"
          required
          error={form.formState.errors.tenantAdministrator?.password?.message}
        >
          <PasswordInput required aria-label="Initial password" aria-invalid={Boolean(form.formState.errors.tenantAdministrator?.password)} data-field-label="Initial password" {...form.register("tenantAdministrator.password")} />
        </Field>
        <Field label="Phone number" required error={form.formState.errors.tenantAdministrator?.phone?.message}>
          <Input required aria-label="Phone number" aria-invalid={Boolean(form.formState.errors.tenantAdministrator?.phone)} data-field-label="Phone number" type="tel" autoComplete="tel" {...form.register("tenantAdministrator.phone")} />
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
          required
          error={form.formState.errors.tenantAdministrator?.email?.message}
        >
          <Input required aria-label="Tenant Administrator email" aria-invalid={Boolean(form.formState.errors.tenantAdministrator?.email)} data-field-label="Tenant Administrator email" type="email" {...form.register("tenantAdministrator.email")} />
        </Field>
        <Field label="Temporary password" required error={form.formState.errors.tenantAdministrator?.password?.message}>
          <PasswordInput required aria-label="Temporary password" aria-invalid={Boolean(form.formState.errors.tenantAdministrator?.password)} data-field-label="Temporary password" {...form.register("tenantAdministrator.password")} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input required data-field-label="tenant details" type="checkbox" className="mt-1" {...form.register("confirm")} />
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
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      <span>
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
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
