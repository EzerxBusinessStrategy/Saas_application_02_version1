"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MoreHorizontal, ShieldCheck } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  chartAxisTick,
  chartTooltipCursor,
  ChartTooltipContent,
} from "@/components/dashboard/chart-tooltip";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listAuditRecords } from "@/features/administration/api/administration-api";
import {
  getPlatformConfiguration,
  updatePlatformConfiguration,
} from "@/features/platform/api/super-admin-platform-configuration-api";
import { cn } from "@/lib/utils";
import { getSuperAdminDashboard } from "@/features/platform/api/super-admin-dashboard-api";
import {
  type AuditRecord,
  type AuditListRequest,
} from "@/types/administration";
import type { PlatformConfiguration } from "@/types/platform-configuration";

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function PlatformReports() {
  const reportsQuery = useQuery({
    queryKey: ["super-admin-reports"],
    queryFn: () => getSuperAdminDashboard({}),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });
  const tenants = reportsQuery.data?.tenantHealth ?? [];

  if (reportsQuery.isLoading) {
    return <LoadingState label="Loading global reports" rows={4} />;
  }

  if (reportsQuery.isError || !reportsQuery.data) {
    return (
      <ErrorState
        title="Global reports could not load"
        description="Check the backend connection and try again."
        onRetry={() => void reportsQuery.refetch()}
      />
    );
  }

  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        eyebrowIcon={ShieldCheck}
        title="Global reports"
        description="Use tenant health and adoption signals to identify platform support needs."
      />
      <section className="mx-auto w-full max-w-5xl">
        <ChartCard
          className="super-admin-surface"
          title="Tenant health and platform usage"
          description="Compare tenants needing action with adoption signals."
        >
          {tenants.length ? (
            <>
              <div
                role="img"
                aria-label="Active users by tenant"
                className="h-72 min-w-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tenants.map((tenant) => ({
                      name: tenant.tenantName,
                      users: tenant.activeUsers,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tick={chartAxisTick}
                      tickFormatter={(name: string) => name.split(" ")[0]}
                    />
                    <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={<ChartTooltipContent />}
                      cursor={chartTooltipCursor}
                    />
                    <Bar
                      activeBar={{
                        fill: "var(--primary)",
                        opacity: 0.88,
                        stroke: "var(--ring)",
                        strokeWidth: 1,
                      }}
                      dataKey="users"
                      name="Active users"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Review tenants with low adoption or at-risk delivery signals before
                escalating support.
              </p>
              <ul
                className="mt-4 grid gap-2 text-sm sm:grid-cols-2"
                aria-label="Tenant active-user counts"
              >
                {tenants.map((tenant) => (
                  <li
                    key={tenant.tenantId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate" title={tenant.tenantName}>
                      {tenant.tenantName}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {tenant.activeUsers} active users
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              title="No tenant usage data yet"
              description="Tenant activity will appear here when tenant memberships are active."
            />
          )}
        </ChartCard>
      </section>
    </div>
  );
}

export function GlobalAuditLog({ tenantName }: { tenantName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<AuditRecord | null>(null);
  const request: AuditListRequest = {
    query: searchParams.get("query") ?? undefined,
    result: (searchParams.get("result") as AuditRecord["result"]) || undefined,
    sort: (searchParams.get("sort") as AuditListRequest["sort"]) ?? "timestamp",
    page: Math.max(1, Number(searchParams.get("page") ?? "1")),
    pageSize: [5, 10, 25, 50].includes(Number(searchParams.get("pageSize")))
      ? Number(searchParams.get("pageSize"))
      : 10,
  };
  const recordsQuery = useQuery({
    queryKey: ["audit-log", tenantName, request],
      queryFn: () => listAuditRecords(request),
  });
  const records = recordsQuery.data?.items ?? [];
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  };
  const columns: ColumnDef<AuditRecord>[] = [
    { accessorKey: "actor", header: "Actor" },
    { accessorKey: "tenant", header: "Tenant" },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "resource", header: "Resource" },
    {
      id: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => dateTime.format(new Date(row.original.timestamp)),
    },
    { accessorKey: "ipAddress", header: "IP address" },
    {
      id: "reason",
      header: "Reason",
      cell: ({ row }) => row.original.reason ?? "—",
    },
    {
      id: "result",
      header: "Result",
      cell: ({ row }) => (
        <StatusBadge
          status={
            row.original.result === "success"
              ? "complete"
              : row.original.result === "failed"
                ? "blocked"
                : "pending"
          }
          className={tenantName ? undefined : "whitespace-nowrap"}
        />
      ),
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
              aria-label={`Actions for audit record ${row.original.id}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setSelected(row.original)}>
              View details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
  if (recordsQuery.isPending)
    return <LoadingState label="Loading global audit records" rows={5} />;
  if (recordsQuery.isError)
    return (
      <ErrorState
        title="Audit records could not load"
        onRetry={() => void recordsQuery.refetch()}
      />
    );
  return (
    <div
      className={cn(
        "flex flex-col gap-[30px]",
        !tenantName && "super-admin-portal",
      )}
    >
      <PageHeader
        eyebrow={tenantName ? "Tenant Admin" : "Super Admin"}
        eyebrowIcon={tenantName ? undefined : ShieldCheck}
        title={tenantName ? "Tenant audit log" : "Global audit logs"}
        description={
          tenantName
            ? "Review administrative actions recorded for your tenant workspace."
            : "Review administrative actions with actor, tenant, reason, result, and network context."
        }
      />
      <Card className={cn(!tenantName && "super-admin-surface")}>
        <CardHeader>
          <CardTitle>Audit activity</CardTitle>
          <CardDescription>
            Audit visibility is read-only in the frontend. Server-side tenant
            scoping and access control remain required.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FilterToolbar
            search={{
              value: request.query ?? "",
              onChange: (value) => setParam("query", value),
              label: "Search global audit logs",
              placeholder: "Search actor, tenant, action, or resource",
            }}
            trailing={
              <Select
                aria-label="Audit sort order"
                className="w-40"
                value={request.sort}
                onChange={(event) => setParam("sort", event.target.value)}
              >
                <option value="timestamp">Newest first</option>
                <option value="actor">Actor</option>
                <option value="tenant">Tenant</option>
              </Select>
            }
            activeFilterCount={
              [request.query, request.result].filter(Boolean).length
            }
            onClear={() => router.replace(pathname, { scroll: false })}
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Result
              <Select
                aria-label="Filter audit result"
                value={request.result ?? ""}
                onChange={(event) => setParam("result", event.target.value)}
              >
                <option value="">All results</option>
                <option value="success">Success</option>
                <option value="denied">Denied</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </Select>
            </label>
          </FilterToolbar>
          {records.length ? (
            <>
              <DataTable
                className={tenantName ? undefined : "super-admin-table"}
                caption={
                  tenantName ? "Tenant audit records" : "Global audit records"
                }
                columns={columns}
                data={records}
                emptyTitle="No audit records"
                emptyDescription="Administrative events will appear here."
              />
              <Pagination
                page={recordsQuery.data?.page ?? request.page}
                pageCount={recordsQuery.data?.pageCount ?? 1}
                totalItems={recordsQuery.data?.totalItems ?? 0}
                pageSize={request.pageSize}
                onPageChange={(value) => setParam("page", String(value))}
                onPageSizeChange={(value) =>
                  setParam("pageSize", String(value))
                }
                isLoading={recordsQuery.isFetching}
              />
            </>
          ) : (
            <EmptyState
              title={
                request.query || request.result
                  ? "No audit records match these filters"
                  : "No audit records"
              }
              description="Try a different filter or wait for recorded platform activity."
            />
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          title="Audit event details"
          description="Read-only global audit record."
          className="left-auto right-0 top-0 h-full w-full max-w-xl translate-x-0 translate-y-0 rounded-none"
        >
          <div className="pr-8">
            <h2 className="font-semibold">Audit event details</h2>
            {selected ? (
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Actor</dt>
                  <dd className="mt-1 font-medium">{selected.actor}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tenant and resource</dt>
                  <dd className="mt-1 font-medium">
                    {selected.tenant} · {selected.resource}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Action and result</dt>
                  <dd className="mt-1 font-medium">
                    {selected.action} · {selected.result}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="mt-1">
                    {selected.reason ?? "No reason recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Detail</dt>
                  <dd className="mt-1">{selected.detail}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Network context</dt>
                  <dd className="mt-1">
                    {selected.ipAddress} ·{" "}
                    {dateTime.format(new Date(selected.timestamp))}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PlatformConfigurationInput = {
  platformName: string;
  defaultBrand: string;
  senderName: string;
};

const defaultPlatformConfiguration: PlatformConfiguration = {
  platformName: "SaaS App",
  defaultBrand: "#3C50E0",
  senderName: "SaaS App",
};

function formatHexAsRgb(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "Enter a valid hex value";
  return `RGB ${[1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)).join(", ")}`;
}

export function PlatformConfiguration() {
  const queryClient = useQueryClient();
  const configurationQuery = useQuery({
    queryKey: ["platform-configuration"],
    queryFn: getPlatformConfiguration,
  });
  const form = useForm<PlatformConfigurationInput>({
    defaultValues: {
      ...defaultPlatformConfiguration,
    },
  });
  const defaultBrand = form.watch("defaultBrand");
  const saveConfiguration = useMutation({
    mutationFn: updatePlatformConfiguration,
    onSuccess: async (configuration) => {
      queryClient.setQueryData(["platform-configuration"], configuration);
      form.reset(configuration);
    },
  });

  useEffect(() => {
    if (configurationQuery.data) form.reset(configurationQuery.data);
  }, [configurationQuery.data, form]);

  const publish = (draft: PlatformConfigurationInput) => {
    saveConfiguration.mutate({
      ...draft,
      defaultBrand: draft.defaultBrand.toUpperCase(),
    });
  };

  if (configurationQuery.isPending) return <LoadingState label="Loading platform configuration" rows={2} />;
  if (configurationQuery.isError) {
    return <ErrorState title="Platform configuration could not load" description="Try again to retrieve the saved platform defaults." onRetry={() => void configurationQuery.refetch()} />;
  }

  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        eyebrowIcon={ShieldCheck}
        title="Platform configuration"
        description="Set constrained platform identity, branding, and email defaults."
      />
      <form
        className="flex flex-col gap-[30px]"
        onSubmit={form.handleSubmit(publish)}
      >
        {saveConfiguration.isSuccess ? (
          <Card role="status" className="super-admin-surface">
            <CardContent className="p-[30px]">
              <p className="font-medium">Platform configuration saved</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Saved to the platform database and applied to the Super Admin shell.
              </p>
            </CardContent>
          </Card>
        ) : null}
        {saveConfiguration.isError ? (
          <Card role="alert" className="border-danger/40">
            <CardContent className="p-[30px] text-sm text-danger">
              {saveConfiguration.error.message}
            </CardContent>
          </Card>
        ) : null}
        <Card className="super-admin-surface">
          <CardHeader>
            <CardTitle>Platform identity and branding</CardTitle>
            <CardDescription>
              Branding is limited to the approved design-token palette.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">
              Platform name
              <Input
                className="mt-1"
                {...form.register("platformName", { required: true })}
              />
            </label>
            <label className="text-sm font-medium">
              Default brand colour
              <span className="mt-1 flex gap-2">
                <Input
                  className="min-w-0"
                  aria-label="Default brand colour hexadecimal value"
                  aria-invalid={Boolean(form.formState.errors.defaultBrand)}
                  {...form.register("defaultBrand", {
                    pattern: {
                      value: /^#[0-9A-Fa-f]{6}$/,
                      message: "Use a six-digit hex colour.",
                    },
                  })}
                />
                <input
                  aria-label="Choose default brand colour from palette"
                  className="size-10 shrink-0 cursor-pointer rounded-[var(--radius-control)] border border-border bg-transparent p-1"
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(defaultBrand)
                      ? defaultBrand
                      : defaultPlatformConfiguration.defaultBrand
                  }
                  onChange={(event) =>
                    form.setValue(
                      "defaultBrand",
                      event.target.value.toUpperCase(),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                />
              </span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {formatHexAsRgb(defaultBrand)}
              </span>
              {form.formState.errors.defaultBrand ? (
                <span className="mt-1 block text-xs font-normal text-danger">
                  {form.formState.errors.defaultBrand.message}
                </span>
              ) : null}
            </label>
          </CardContent>
        </Card>
        <Card className="super-admin-surface">
          <CardHeader>
            <CardTitle>Email and platform defaults</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">
              Email sender name
              <Input
                className="mt-1"
                {...form.register("senderName", { required: true })}
              />
            </label>
          </CardContent>
          <CardContent className="flex justify-end pt-0">
            <Button type="submit" disabled={saveConfiguration.isPending}>
              {saveConfiguration.isPending ? "Saving configuration" : "Publish platform configuration"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
