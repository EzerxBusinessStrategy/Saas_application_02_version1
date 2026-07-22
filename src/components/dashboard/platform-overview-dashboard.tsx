"use client";

import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/operations/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { AuditEvent, PlatformOverview } from "@/types/platform-overview";

const auditColumns: ColumnDef<AuditEvent, unknown>[] = [
  { accessorKey: "actor", header: "Actor" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "target", header: "Target" },
  { accessorKey: "time", header: "Time" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.status}
        className="whitespace-nowrap"
      />
    ),
  },
];

export function PlatformOverviewDashboard({
  overview,
}: {
  overview: PlatformOverview;
}) {
  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        eyebrowIcon={ShieldCheck}
        title="Platform overview"
        description="Tenant health and platform activity across every workspace."
        actions={
          <p
            className="text-sm text-muted-foreground"
            aria-label="Reporting period"
          >
            Last 30 days
          </p>
        }
      />
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-5"
        aria-label="Platform key performance indicators"
      >
        {overview.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="super-admin-surface group rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] xl:grid-cols-[1.1fr_1fr_1fr]">
        <Card className="super-admin-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck
                className="super-admin-signal super-admin-signal--health size-[18px] text-primary"
                aria-hidden="true"
              />
              Tenant health
            </CardTitle>
            <CardDescription>
              Tenants requiring operational attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.tenantHealth.length === 0 ? (
              <EmptyState
                title="No tenant health data"
                description="Tenant signals will appear when they are available."
              />
            ) : (
              <ul className="flex flex-col divide-y">
                {overview.tenantHealth.map((tenant) => (
                  <li
                    key={tenant.name}
                    className="super-admin-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{tenant.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {tenant.users} active users · {tenant.detail}
                      </p>
                    </div>
                    <StatusBadge
                      status={tenant.status}
                      className="shrink-0 whitespace-nowrap"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="super-admin-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity
                className="super-admin-signal super-admin-signal--activity size-[18px] text-primary"
                aria-hidden="true"
              />
              Recent platform activity
            </CardTitle>
            <CardDescription>
              Latest tenant and operational changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.recentActivity.length === 0 ? (
              <EmptyState
                title="No recent platform activity"
                description="New platform events will be shown here."
              />
            ) : (
              <ol className="flex flex-col gap-4">
                {overview.recentActivity.map((activity) => (
                  <li
                    key={`${activity.title}-${activity.time}`}
                    className="super-admin-row py-1"
                  >
                    <p className="font-medium">{activity.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {activity.detail}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.time}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card className="super-admin-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle
                className="super-admin-signal super-admin-signal--alert size-[18px] text-warning"
                aria-hidden="true"
              />
              Platform alerts
            </CardTitle>
            <CardDescription>
              Issues that need a platform response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.alerts.length === 0 ? (
              <EmptyState
                title="No platform alerts"
                description="There are no issues requiring action."
              />
            ) : (
              <ul className="flex flex-col divide-y">
                {overview.alerts.map((alert) => (
                  <li
                    key={alert.title}
                    className="super-admin-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{alert.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {alert.detail}
                      </p>
                    </div>
                    <StatusBadge
                      status={alert.status}
                      className="shrink-0 whitespace-nowrap"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
      <Card className="super-admin-surface">
        <CardHeader>
          <CardTitle>Global audit activity</CardTitle>
          <CardDescription>
            Platform-wide administrative actions. Frontend visibility does not
            replace backend audit authorization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            className="super-admin-table"
            caption="Global audit activity"
            columns={auditColumns}
            data={overview.auditEvents}
            emptyTitle="No audit activity"
            emptyDescription="Platform administrative events will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
