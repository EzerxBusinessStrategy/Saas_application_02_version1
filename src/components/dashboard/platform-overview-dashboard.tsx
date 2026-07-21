"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
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
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export function PlatformOverviewDashboard({
  overview,
}: {
  overview: PlatformOverview;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        title="Platform overview"
        description="Tenant health and platform activity across every workspace."
        actions={
          <Button variant="outline">
            <CalendarDays data-icon="inline-start" />
            Last 30 days
          </Button>
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
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] xl:grid-cols-[1.1fr_1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-[18px] text-primary" />
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
                    className="flex items-start justify-between gap-3 py-4 first:pt-0"
                  >
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {tenant.users} active users · {tenant.detail}
                      </p>
                    </div>
                    <StatusBadge status={tenant.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-[18px] text-primary" />
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
                  <li key={`${activity.title}-${activity.time}`}>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-[18px] text-warning" />
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
                    className="flex items-start justify-between gap-3 py-4 first:pt-0"
                  >
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {alert.detail}
                      </p>
                    </div>
                    <StatusBadge status={alert.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Global audit activity</CardTitle>
          <CardDescription>
            Platform-wide administrative actions. Frontend visibility does not
            replace backend audit authorization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
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
