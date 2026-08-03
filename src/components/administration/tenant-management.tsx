"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import { DataTable } from "@/components/operations/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityHeader } from "@/components/shared/entity-header";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getTenant,
  listAuditRecords,
  listTenants,
} from "@/features/administration/api/administration-api";
import { tenants } from "@/mocks/administration";
import {
  legacyCreateTenantSchema,
  supportAccessSchema,
  type LegacyCreateTenantInput,
  type SupportAccessRequest,
  type Tenant,
  type TenantListRequest,
} from "@/types/administration";

const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const tenantTabs = [
  { value: "overview", label: "Overview" },
  { value: "users", label: "Users" },
  { value: "usage", label: "Usage" },
  { value: "audit", label: "Audit logs" },
  { value: "configuration", label: "Configuration" },
  { value: "support", label: "Support access" },
];

type SupportAccessFormInput = z.input<typeof supportAccessSchema>;
type TenantCreateFormInput = z.input<typeof legacyCreateTenantSchema>;

const previewState = (value: string | null) =>
  value === "loading" || value === "error" || value === "empty" ? value : null;

function applySearchParam(
  pathname: string,
  searchParams: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  key: string,
  value: string,
) {
  const next = new URLSearchParams(searchParams);
  value ? next.set(key, value) : next.delete(key);
  if (key !== "page") next.delete("page");
  router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
    scroll: false,
  });
}

function TenantCard({
  tenant,
  onOpen,
  onChangeStatus,
}: {
  tenant: Tenant;
  onOpen: () => void;
  onChangeStatus: () => void;
}) {
  return (
    <MobileEntityCard
      title={tenant.name}
      identifier={tenant.code}
      status={<StatusBadge status={tenant.status} />}
      metadata={
        <>
          <div>
            <dt className="text-muted-foreground">Employees</dt>
            <dd className="mt-0.5">{tenant.employeeCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="mt-0.5">
              {date.format(new Date(tenant.createdAt))}
            </dd>
          </div>
        </>
      }
      primaryAction={
        <Button variant="outline" size="sm" onClick={onOpen}>
          View tenant
        </Button>
      }
      overflowActions={[
        {
          label:
            tenant.status === "suspended"
              ? "Reactivate tenant"
              : "Suspend tenant",
          onSelect: onChangeStatus,
        },
      ]}
    />
  );
}

export function TenantDirectory() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lifecycleTarget, setLifecycleTarget] = useState<Tenant | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, Tenant["status"]>
  >({});
  const request = useMemo<TenantListRequest>(
    () => ({
      query: searchParams.get("query") ?? undefined,
      status: searchParams.get("status") as TenantListRequest["status"],
      createdAfter: searchParams.get("createdAfter") ?? undefined,
      sort: (searchParams.get("sort") as TenantListRequest["sort"]) ?? "name",
      page: Math.max(1, Number(searchParams.get("page") ?? "1")),
      pageSize: [5, 10, 25, 50].includes(Number(searchParams.get("pageSize")))
        ? Number(searchParams.get("pageSize"))
        : 5,
    }),
    [searchParams],
  );
  const query = useQuery({
    queryKey: ["tenants", request],
    queryFn: () => listTenants(request),
  });
  const forcedState = previewState(searchParams.get("state"));
  const setParam = (key: string, value: string) =>
    applySearchParam(
      pathname,
      new URLSearchParams(searchParams),
      router,
      key,
      value,
    );
  const clearFilters = () => router.replace(pathname, { scroll: false });
  const activeFilters = [
    request.query,
    request.status,
    request.createdAfter,
  ].filter(Boolean).length;
  const rows = (forcedState === "empty" ? [] : (query.data?.items ?? [])).map(
    (tenant) => ({
      ...tenant,
      status: statusOverrides[tenant.id] ?? tenant.status,
    }),
  );

  const columns: ColumnDef<Tenant>[] = [
    {
      id: "tenant",
      header: "Tenant",
      cell: ({ row }) => (
        <div>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() =>
              router.push(`/super-admin/tenants/${row.original.id}`)
            }
          >
            {row.original.name}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.original.code}
          </p>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      cell: ({ row }) => (
        <div>
          <p>{row.original.owner.name}</p>
          <p
            className="mt-1 max-w-44 truncate text-xs text-muted-foreground"
            title={row.original.owner.email}
          >
            {row.original.owner.email}
          </p>
        </div>
      ),
    },
    {
      id: "employees",
      header: () => (
        <button
          type="button"
          className="inline-flex items-center gap-1"
          onClick={() =>
            setParam(
              "sort",
              request.sort === "employees" ? "name" : "employees",
            )
          }
        >
          Employees <ArrowUpDown className="size-3.5" aria-hidden="true" />
        </button>
      ),
      cell: ({ row }) => (
        <span>
          {row.original.employeeCount} employees
          <p className="mt-1 text-xs text-muted-foreground">
            {row.original.clientCount} clients
          </p>
        </span>
      ),
    },
    {
      id: "status",
      header: "Tenant status",
      cell: ({ row }) => (
        <StatusBadge
          status={statusOverrides[row.original.id] ?? row.original.status}
          className="whitespace-nowrap"
        />
      ),
    },
    {
      id: "createdAt",
      header: () => (
        <button
          type="button"
          className="inline-flex items-center gap-1"
          onClick={() =>
            setParam(
              "sort",
              request.sort === "createdAt" ? "name" : "createdAt",
            )
          }
        >
          Created <ArrowUpDown className="size-3.5" aria-hidden="true" />
        </button>
      ),
      cell: ({ row }) => date.format(new Date(row.original.createdAt)),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Actions for ${row.original.name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/super-admin/tenants/${row.original.id}`)
              }
            >
              View tenant
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLifecycleTarget(row.original)}>
              {(statusOverrides[row.original.id] ?? row.original.status) ===
              "suspended"
                ? "Reactivate tenant"
                : "Suspend tenant"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (forcedState === "loading" || query.isPending)
    return <LoadingState label="Loading tenants" rows={5} />;
  if (forcedState === "error" || query.isError)
    return (
      <ErrorState
        title="Tenant list could not load"
        description="Try again to retrieve the platform tenant directory."
        onRetry={() => {
          void query.refetch();
          setParam("state", "");
        }}
      />
    );

  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        eyebrowIcon={ShieldCheck}
        title="Tenant management"
        description="Control tenant lifecycle and operational context across the platform."
        actions={
          <Link
            href="/super-admin/tenants/new"
            className={buttonVariants({ className: "super-admin-action" })}
          >
            Create tenant
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Tenant directory</CardTitle>
          <CardDescription>
            Searchable tenant records from the platform database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FilterToolbar
            search={{
              value: request.query ?? "",
              onChange: (value) => setParam("query", value),
              label: "Search tenants",
              placeholder: "Search tenant, code, or owner",
            }}
            activeFilterCount={activeFilters}
            onClear={clearFilters}
            trailing={
              <Select
                aria-label="Tenant sort order"
                className="w-36"
                value={request.sort}
                onChange={(event) => setParam("sort", event.target.value)}
              >
                <option value="name">Name</option>
                <option value="createdAt">Newest</option>
                <option value="employees">Employees</option>
              </Select>
            }
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Tenant status
              <Select
                aria-label="Filter by tenant status"
                value={request.status ?? ""}
                onChange={(event) => setParam("status", event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="pending_activation">Pending activation</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Created after
              <Input
                aria-label="Filter by created date"
                type="date"
                value={request.createdAfter ?? ""}
                onChange={(event) =>
                  setParam("createdAfter", event.target.value)
                }
              />
            </label>
          </FilterToolbar>
          {rows.length === 0 ? (
            <EmptyState
              title={
                activeFilters
                  ? "No tenants match these filters"
                  : "No tenants yet"
              }
              description={
                activeFilters
                  ? "Try changing or clearing the filters."
                  : "Create the first tenant when an organisation is ready to join the platform."
              }
            />
          ) : (
            <>
              <div className="hidden md:block">
                <DataTable
                  className="super-admin-table"
                  caption="Tenants in the platform"
                  columns={columns}
                  data={rows}
                  emptyTitle="No tenants"
                  emptyDescription="Tenant records will appear here."
                />
              </div>
              <div className="md:hidden">
                {rows.map((tenant) => (
                  <TenantCard
                    key={tenant.id}
                    tenant={tenant}
                    onOpen={() =>
                      router.push(`/super-admin/tenants/${tenant.id}`)
                    }
                    onChangeStatus={() => setLifecycleTarget(tenant)}
                  />
                ))}
              </div>
              <Pagination
                page={query.data?.page ?? request.page}
                pageCount={query.data?.pageCount ?? 1}
                totalItems={query.data?.totalItems ?? 0}
                pageSize={request.pageSize}
                onPageChange={(value) => setParam("page", String(value))}
                onPageSizeChange={(value) =>
                  setParam("pageSize", String(value))
                }
                isLoading={query.isFetching}
              />
            </>
          )}
        </CardContent>
      </Card>
      <ConfirmationDialog
        open={Boolean(lifecycleTarget)}
        onOpenChange={(open) => !open && setLifecycleTarget(null)}
        title={
          lifecycleTarget?.status === "suspended"
            ? "Reactivate tenant"
            : "Suspend tenant"
        }
        description={
          lifecycleTarget?.status === "suspended"
            ? "The tenant will be able to sign in again. Record the supporting business approval in the backend audit log."
            : "Suspending blocks tenant access. Confirm the billing and support context before proceeding."
        }
        confirmLabel={
          lifecycleTarget?.status === "suspended"
            ? "Reactivate tenant"
            : "Suspend tenant"
        }
        destructive={lifecycleTarget?.status !== "suspended"}
        onConfirm={() => {
          if (lifecycleTarget)
            setStatusOverrides((current) => ({
              ...current,
              [lifecycleTarget.id]:
                lifecycleTarget.status === "suspended" ? "active" : "suspended",
            }));
          setLifecycleTarget(null);
        }}
      />
    </div>
  );
}

export function TenantCreateForm() {
  const router = useRouter();
  const [prepared, setPrepared] = useState<LegacyCreateTenantInput | null>(null);
  const form = useForm<TenantCreateFormInput, unknown, LegacyCreateTenantInput>({
    resolver: zodResolver(legacyCreateTenantSchema),
    defaultValues: {
      name: "",
      code: "",
      legalName: "",
      businessEmail: "",
      country: "India",
      currency: "INR",
      ownerName: "",
      ownerEmail: "",
      administratorPhone: "",
      plan: "professional",
      billingCycle: "monthly",
      userLimit: 100,
      modules: ["dashboard", "clients", "tasks", "documents", "reports"],
      primaryColour: "#3C50E0",
      sidebarColour: "#1C2434",
      defaultTheme: "system",
      timeZone: "Asia/Kolkata",
      portalSlug: "",
      activationMethod: "invitation",
      inviteOwner: true,
      confirm: false,
    },
  });
  const submit = (values: LegacyCreateTenantInput) => setPrepared(values);
  const inputClass = "mt-1";
  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        eyebrowIcon={ShieldCheck}
        title="Create tenant"
        description="Prepare a tenant provisioning request. This validated form uses mock data only; it does not create a live tenant."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/super-admin/tenants")}
          >
            Back to tenants
          </Button>
        }
      />
      {prepared ? (
        <Card role="status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2
                className="size-5 text-success"
                aria-hidden="true"
              />
              Tenant request prepared
            </CardTitle>
            <CardDescription>
              {prepared.name} ({prepared.code}) is ready for a future
              provisioning API. The owner invitation setting and initial
              configuration are included in the typed request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/super-admin/tenants")}>
              Return to tenant directory
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <ol className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6" aria-label="Tenant provisioning steps">
        {[
          "Company",
          "Administrator",
          "Limits",
          "Branding",
          "Access",
          "Review",
        ].map((step, index) => (
          <li key={step} className="rounded-[var(--radius-control)] border border-border px-2 py-2 text-muted-foreground">
            {index + 1}. {step}
          </li>
        ))}
      </ol>
      <form
        className="flex flex-col gap-[30px]"
        noValidate
        onSubmit={form.handleSubmit(submit)}
      >
        <Card>
          <CardHeader>
            <CardTitle>Organisation details</CardTitle>
            <CardDescription>
              Give the tenant a clear identity and accountable owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">
              Organisation name
              <Input
                className={inputClass}
                autoComplete="organization"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <span className="mt-1 block text-xs text-danger">
                  {form.formState.errors.name.message}
                </span>
              ) : null}
            </label>
            <label className="text-sm font-medium">
              Tenant code
              <Input
                className={inputClass}
                aria-describedby="tenant-code-help"
                aria-invalid={Boolean(form.formState.errors.code)}
                {...form.register("code", {
                  onChange: (event) => {
                    event.target.value = event.target.value.toUpperCase();
                  },
                })}
              />
              {form.formState.errors.code ? (
                <span className="mt-1 block text-xs text-danger">
                  {form.formState.errors.code.message}
                </span>
              ) : (
                <span
                  id="tenant-code-help"
                  className="mt-1 block text-xs text-muted-foreground"
                >
                  Used in platform records and URLs.
                </span>
              )}
            </label>
            <label className="text-sm font-medium">
              Legal name
              <Input className={inputClass} {...form.register("legalName")} />
            </label>
            <label className="text-sm font-medium">
              Business email
              <Input className={inputClass} type="email" {...form.register("businessEmail")} />
              {form.formState.errors.businessEmail ? <span className="mt-1 block text-xs text-danger">{form.formState.errors.businessEmail.message}</span> : null}
            </label>
            <label className="text-sm font-medium">
              Country
              <Select className={inputClass} {...form.register("country")}>
                <option value="India">India</option><option value="United Kingdom">United Kingdom</option><option value="United States">United States</option>
              </Select>
            </label>
            <label className="text-sm font-medium">
              Default currency
              <Select className={inputClass} {...form.register("currency")}>
                <option value="INR">INR</option><option value="USD">USD</option><option value="GBP">GBP</option>
              </Select>
            </label>
            <label className="text-sm font-medium">
              Tenant owner
              <Input
                className={inputClass}
                autoComplete="name"
                aria-invalid={Boolean(form.formState.errors.ownerName)}
                {...form.register("ownerName")}
              />
              {form.formState.errors.ownerName ? (
                <span className="mt-1 block text-xs text-danger">
                  {form.formState.errors.ownerName.message}
                </span>
              ) : null}
            </label>
            <label className="text-sm font-medium">
              Owner email
              <Input
                className={inputClass}
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(form.formState.errors.ownerEmail)}
                {...form.register("ownerEmail")}
              />
              {form.formState.errors.ownerEmail ? (
                <span className="mt-1 block text-xs text-danger">
                  {form.formState.errors.ownerEmail.message}
                </span>
              ) : null}
            </label>
            <label className="text-sm font-medium">
              Administrator phone <span className="font-normal text-muted-foreground">(optional)</span>
              <Input className={inputClass} type="tel" {...form.register("administratorPhone")} />
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription and limits</CardTitle>
            <CardDescription>
              These selected limits are a typed frontend request. A backend must enforce every plan and module rule.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">Plan<Select className={inputClass} {...form.register("plan")}><option value="essential">Essential</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></Select></label>
            <label className="text-sm font-medium">Billing cycle<Select className={inputClass} {...form.register("billingCycle")}><option value="monthly">Monthly</option><option value="annual">Annual</option></Select></label>
            <label className="text-sm font-medium">User limit<Input className={inputClass} min="1" type="number" {...form.register("userLimit")} /></label>
            <fieldset className="md:col-span-2"><legend className="text-sm font-medium">Enabled modules</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{["dashboard", "clients", "tasks", "work-groups", "employees", "managers", "documents", "invoices", "reports", "support"].map((module) => <label key={module} className="flex items-center gap-2 text-sm"><input type="checkbox" value={module} {...form.register("modules")} />{module.replace("-", " ")}</label>)}</div>{form.formState.errors.modules ? <p className="mt-1 text-xs text-danger">{form.formState.errors.modules.message}</p> : null}</fieldset>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Branding and initial configuration</CardTitle>
            <CardDescription>
              Defaults are constrained to the TailAdmin token system; arbitrary
              inaccessible styling is not allowed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">
              Primary brand colour
              <Input
                className={inputClass}
                aria-invalid={Boolean(form.formState.errors.primaryColour)}
                {...form.register("primaryColour")}
              />
              {form.formState.errors.primaryColour ? (
                <span className="mt-1 block text-xs text-danger">
                  {form.formState.errors.primaryColour.message}
                </span>
              ) : null}
            </label>
            <label className="text-sm font-medium">Sidebar colour<Input className={inputClass} {...form.register("sidebarColour")} />{form.formState.errors.sidebarColour ? <span className="mt-1 block text-xs text-danger">{form.formState.errors.sidebarColour.message}</span> : null}</label>
            <label className="text-sm font-medium">Default theme<Select className={inputClass} {...form.register("defaultTheme")}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Follow system</option></Select></label>
            <label className="text-sm font-medium">
              Tenant time zone
              <Select className={inputClass} {...form.register("timeZone")}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New York</option>
              </Select>
            </label>
            <label className="flex items-start gap-3 text-sm md:col-span-2">
              <input
                className="mt-1 size-4 accent-primary"
                type="checkbox"
                {...form.register("inviteOwner")}
              />
              <span>
                <span className="block font-medium">
                  Send the owner invitation
                </span>
                <span className="block text-muted-foreground">
                  The backend will issue a time-limited invitation after
                  provisioning.
                </span>
              </span>
            </label>
            <div className="rounded-[var(--radius-control)] border border-dashed border-border p-4 text-sm text-muted-foreground md:col-span-2"><p className="font-medium text-foreground">Logo upload is unavailable</p><p className="mt-1">Private tenant-scoped logo storage must be connected before files can be accepted.</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Domain and access</CardTitle><CardDescription>Use the current path-based routing model. Custom-domain verification requires infrastructure.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2"><label className="text-sm font-medium">Tenant portal slug<Input className={inputClass} aria-describedby="portal-slug-help" {...form.register("portalSlug")} />{form.formState.errors.portalSlug ? <span className="mt-1 block text-xs text-danger">{form.formState.errors.portalSlug.message}</span> : <span id="portal-slug-help" className="mt-1 block text-xs text-muted-foreground">Portal URL: platform.example/{form.watch("portalSlug") || "tenant-slug"}</span>}</label><div className="rounded-[var(--radius-control)] border border-border p-4 text-sm text-muted-foreground">Activation is by secure invitation. Passwords are not collected or stored by this frontend.</div></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Confirmation summary</CardTitle>
            <CardDescription>
              Review the organisation, owner, and initial defaults before
              preparing the request.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Organisation</dt>
                <dd className="mt-1 font-medium">
                  {form.watch("name") || "Not entered"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="mt-1 font-medium">
                  {form.watch("ownerEmail") || "Not entered"}
                </dd>
              </div>
            </dl>
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1 size-4 accent-primary"
                type="checkbox"
                aria-invalid={Boolean(form.formState.errors.confirm)}
                {...form.register("confirm")}
              />
              <span>
                I confirm these details are ready for controlled tenant
                provisioning.
              </span>
            </label>
            {form.formState.errors.confirm ? (
              <p className="text-xs text-danger">
                {form.formState.errors.confirm.message}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Preparing…"
                  : "Prepare tenant request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function SupportAccess({ tenantId: fixedTenantId }: { tenantId?: string }) {
  const [session, setSession] = useState<{
    tenant: string;
    reason: string;
    expiresAt: string;
  } | null>(null);
  const form = useForm<SupportAccessFormInput, unknown, SupportAccessRequest>({
    resolver: zodResolver(supportAccessSchema),
    defaultValues: {
      tenantId: fixedTenantId ?? "",
      reason: "",
      durationMinutes: 30,
    },
  });
  const submit = (values: SupportAccessRequest) => {
    const tenant = tenants.find((item) => item.id === values.tenantId);
    setSession({
      tenant: tenant?.name ?? "Selected tenant",
      reason: values.reason,
      expiresAt: new Date(
        Date.now() + values.durationMinutes * 60000,
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };
  return (
    <div className="flex flex-col gap-5">
      {session ? (
        <Card role="status" aria-live="polite" className="border-warning">
          <CardContent className="flex flex-col gap-3 p-[30px] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">
                Support mode is visible and time-limited
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.tenant} · expires at {session.expiresAt} · reason:{" "}
                {session.reason}
              </p>
            </div>
            <Button variant="outline" onClick={() => setSession(null)}>
              Exit support mode
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <form
        className="grid gap-5 md:grid-cols-2"
        onSubmit={form.handleSubmit(submit)}
      >
        <div>
          <label htmlFor="support-tenant" className="text-sm font-medium">
            Tenant
          </label>
          <Select
            id="support-tenant"
            className="mt-1"
            disabled={Boolean(fixedTenantId)}
            {...form.register("tenantId")}
          >
            <option value="">Choose a tenant</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
          {form.formState.errors.tenantId ? (
            <span className="mt-1 block text-xs text-danger">
              {form.formState.errors.tenantId.message}
            </span>
          ) : null}
        </div>
        <div>
          <label htmlFor="support-duration" className="text-sm font-medium">
            Maximum session time
          </label>
          <Select
            id="support-duration"
            className="mt-1"
            {...form.register("durationMinutes")}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
            <option value="120">2 hours</option>
          </Select>
        </div>
        <label
          htmlFor="support-reason"
          className="text-sm font-medium md:col-span-2"
        >
          Access reason
          <textarea
            id="support-reason"
            className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-invalid={Boolean(form.formState.errors.reason)}
            {...form.register("reason")}
          />
          {form.formState.errors.reason ? (
            <span className="mt-1 block text-xs text-danger">
              {form.formState.errors.reason.message}
            </span>
          ) : (
            <span className="mt-1 block text-xs text-muted-foreground">
              This reason is shown in the support banner and future audit
              record.
            </span>
          )}
        </label>
        <div className="md:col-span-2">
          <Button type="submit">
            <ShieldCheck data-icon="inline-start" />
            Start visible support session
          </Button>
        </div>
      </form>
    </div>
  );
}

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState("overview");
  const query = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenant(tenantId),
  });
  const audit = useQuery({
    queryKey: ["audit-records", tenantId],
    queryFn: () => listAuditRecords({ page: 1, pageSize: 100 }),
  });
  if (query.isPending)
    return <LoadingState label="Loading tenant details" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Tenant details could not load"
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data)
    return (
      <EmptyState
        title="Tenant not found"
        description="This tenant may have been removed or the address is incorrect."
      />
    );
  const tenant = query.data;
  const panel =
    tab === "overview" ? (
      <section className="grid gap-[30px] lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Tenant health</CardTitle>
            <CardDescription>Usage and lifecycle indicators.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatusBadge status={tenant.status} />
            <p className="text-sm text-muted-foreground">
              {tenant.usagePercent}% of the included user allocation is
              currently used.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Owner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{tenant.owner.name}</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {tenant.owner.email}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tenant record</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              Created {date.format(new Date(tenant.createdAt))}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tenant.clientCount} client organisations are currently active.
            </p>
          </CardContent>
        </Card>
      </section>
    ) : tab === "users" ? (
      <Card>
        <CardHeader>
          <CardTitle>Tenant users</CardTitle>
          <CardDescription>
            Current frontend summary; user administration requires the future
            tenant-scoped API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Active users</dt>
              <dd className="mt-1 text-2xl font-bold">
                {tenant.employeeCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Client contacts</dt>
              <dd className="mt-1 text-2xl font-bold">{tenant.clientCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Owner invitation
              </dt>
              <dd className="mt-1">
                <StatusBadge status="active" />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    ) : tab === "usage" ? (
      <Card>
        <CardHeader>
          <CardTitle>Tenant usage</CardTitle>
          <CardDescription>Current employee allocation usage.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="h-3 overflow-hidden rounded-[var(--radius-control)] bg-muted"
            aria-label={`${tenant.usagePercent}% user allocation used`}
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${tenant.usagePercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm">
            <strong>{tenant.usagePercent}%</strong> of the included allocation
            is used.
          </p>
        </CardContent>
      </Card>
    ) : tab === "audit" ? (
      <Card>
        <CardHeader>
          <CardTitle>Tenant audit logs</CardTitle>
          <CardDescription>Actions scoped to this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.isPending ? (
            <LoadingState label="Loading audit records" rows={2} />
          ) : (
            <ul className="flex flex-col divide-y">
              {audit.data?.items
                ?.filter((record) => record.tenant === tenant.name)
                .map((record) => (
                  <li className="py-3 text-sm" key={record.id}>
                    <p className="font-medium">{record.action}</p>
                    <p className="mt-1 text-muted-foreground">
                      {record.actor} ·{" "}
                      {new Date(record.timestamp).toLocaleString()} ·{" "}
                      {record.result}
                    </p>
                  </li>
                )) ?? (
                <EmptyState
                  title="No tenant audit activity"
                  description="Recorded actions will be listed here."
                />
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    ) : tab === "configuration" ? (
      <Card>
        <CardHeader>
          <CardTitle>Tenant configuration</CardTitle>
          <CardDescription>
            Configuration is guarded by controlled platform defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Tenant code</dt>
              <dd className="mt-1 font-medium">{tenant.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Brand token</dt>
              <dd className="mt-1 font-medium">Primary TailAdmin blue</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time zone</dt>
              <dd className="mt-1 font-medium">Asia/Kolkata</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Feature defaults</dt>
              <dd className="mt-1 font-medium">
                Controlled by platform configuration
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>Controlled support access</CardTitle>
          <CardDescription>
            Support sessions are visible, reasoned, time-limited, and auditable.
            They never silently impersonate a tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupportAccess tenantId={tenant.id} />
        </CardContent>
      </Card>
    );
  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <EntityHeader
        eyebrow="Tenant management"
        title={tenant.name}
        description={`${tenant.code} · platform tenant record`}
        metadata={
          <>
            <StatusBadge status={tenant.status} />
            <span>{tenant.employeeCount} employees</span>
            <span>{tenant.clientCount} clients</span>
          </>
        }
        actions={
          <Button variant="outline" onClick={() => history.back()}>
            <ExternalLink data-icon="inline-start" />
            Back to directory
          </Button>
        }
      />
      <ResponsiveTabs
        tabs={tenantTabs}
        value={tab}
        onValueChange={setTab}
        label="Tenant detail sections"
      >
        {panel}
      </ResponsiveTabs>
    </div>
  );
}

export function ControlledSupportAccess() {
  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        eyebrowIcon={ShieldCheck}
        title="Controlled support access"
        description="Open a visible, time-limited support session only when a documented platform support need exists."
      />
      <Card>
        <CardHeader>
          <CardTitle>New support session</CardTitle>
          <CardDescription>
            Support mode is never hidden. This mock records the intended tenant,
            reason, and expiry in the visible interface only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupportAccess />
        </CardContent>
      </Card>
    </div>
  );
}
