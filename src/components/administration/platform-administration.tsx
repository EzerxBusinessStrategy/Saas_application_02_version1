"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
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
import { MoreHorizontal } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
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
import { platformOverview } from "@/mocks/platform-overview";
import {
  type AuditRecord,
  type AuditListRequest,
} from "@/types/administration";

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function PlatformReports() {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        title="Global reports"
        description="Use tenant health and adoption signals to identify platform support needs."
      />
      <section className="max-w-3xl">
        <ChartCard
          title="Tenant health and platform usage"
          description="Compare tenants needing action with adoption signals."
        >
          <div
            role="img"
            aria-label="Two tenants require attention and two are healthy or pending review."
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={platformOverview.tenantHealth.map((tenant) => ({
                  name: tenant.name,
                  users: tenant.users,
                }))}
              >
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis dataKey="name" tickLine={false} axisLine={false} hide />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar
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
        </ChartCard>
      </section>
    </div>
  );
}

export function GlobalAuditLog() {
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
    queryKey: ["global-audit", request],
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
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        title="Global audit logs"
        description="Review administrative actions with actor, tenant, reason, result, and network context."
      />
      <Card>
        <CardHeader>
          <CardTitle>Audit activity</CardTitle>
          <CardDescription>
            Audit visibility is read-only in the frontend. Server-side filtering
            and access control remain required.
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
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </Select>
            </label>
          </FilterToolbar>
          {records.length ? (
            <>
              <DataTable
                caption="Global audit records"
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
  supportSessionLimit: string;
  enforceMfa: boolean;
  reportsEnabled: boolean;
};

export function PlatformConfiguration() {
  const form = useForm<PlatformConfigurationInput>({
    defaultValues: {
      platformName: "EZERX Operations",
      defaultBrand: "#3C50E0",
      senderName: "EZERX Operations",
      supportSessionLimit: "60",
      enforceMfa: true,
      reportsEnabled: true,
    },
  });
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        title="Platform configuration"
        description="Set constrained platform defaults. Applying live security, email, and feature-flag changes requires a server-side configuration workflow."
      />
      <form
        className="flex flex-col gap-[30px]"
        onSubmit={form.handleSubmit(() => setSaved(true))}
      >
        {saved ? (
          <Card role="status">
            <CardContent className="p-[30px]">
              <p className="font-medium">Configuration payload validated</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No live platform settings were changed by this frontend mock.
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
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
              <Input
                className="mt-1"
                {...form.register("defaultBrand", {
                  pattern: /^#[0-9A-Fa-f]{6}$/,
                })}
              />
            </label>
          </CardContent>
        </Card>
        <Card>
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
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security, feature flags, and support rules</CardTitle>
            <CardDescription>
              These controls are frontend-only until the configuration API and
              audit workflow are available.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <label className="text-sm font-medium">
              Maximum support session
              <Select
                className="mt-1 max-w-xs"
                {...form.register("supportSessionLimit")}
              >
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
                <option value="120">2 hours</option>
              </Select>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1 size-4 accent-primary"
                type="checkbox"
                {...form.register("enforceMfa")}
              />
              <span>
                <span className="block font-medium">
                  Require multifactor authentication
                </span>
                <span className="block text-muted-foreground">
                  A future identity provider integration must enforce this on
                  the server.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1 size-4 accent-primary"
                type="checkbox"
                {...form.register("reportsEnabled")}
              />
              <span>
                <span className="block font-medium">
                  Enable platform reporting
                </span>
                <span className="block text-muted-foreground">
                  Controls report visibility after backend authorization is in
                  place.
                </span>
              </span>
            </label>
            <div className="flex justify-end">
              <Button type="submit">Validate configuration</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
