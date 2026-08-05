"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardResponse = {
  tenant: {
    id: string;
    name: string;
    currencyCode: string;
  };
  financialYear: {
    id: string;
    label: string;
    startsOn: string;
    endsOn: string;
  } | null;
  metrics: {
    activeClients: number;
    totalSales: {
      amount: string;
      currencyCode: string;
    };
    openTasks: number;
    overdueTasks: number;
    slaCompliancePercent: number | null;
    employeeUtilisationPercent: number | null;
    outstanding: {
      amount: string;
      currencyCode: string;
    };
  };
  recentActivity: {
    action: string;
    actor: string;
    createdAt: string;
  }[];
};

function formatMoney(amount: string, currencyCode: string): string {
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currencyCode} ${num.toFixed(2)}`;
  }
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function TenantAdministrationOverview() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardResponse>({
    queryKey: ["tenant-operations-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/operations-overview", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load operations overview");
      return res.json();
    },
    staleTime: 10000,
  });

  if (isLoading) {
    return <TenantOverviewSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-lg font-medium text-destructive">Failed to load operations overview</p>
        <p className="text-sm text-muted-foreground">Unable to fetch tenant dashboard metrics from the server.</p>
        <Button variant="outline" onClick={() => void refetch()} className="gap-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  const { metrics, financialYear, recentActivity, tenant } = data;
  const currency = tenant.currencyCode || "INR";

  const cards = [
    {
      label: "Active clients",
      value: metrics.activeClients.toString(),
      change: metrics.activeClients > 0 ? `+${metrics.activeClients} active` : "0 active clients",
      trend: metrics.activeClients > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Total sales",
      value: formatMoney(metrics.totalSales.amount, metrics.totalSales.currencyCode || currency),
      change: financialYear ? financialYear.label : "Total invoiced sales",
      trend: Number(metrics.totalSales.amount) > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Open tasks",
      value: metrics.openTasks.toString(),
      change: metrics.overdueTasks > 0 ? `${metrics.overdueTasks} overdue` : "0 overdue",
      trend: metrics.overdueTasks > 0 ? ("down" as const) : ("flat" as const),
    },
    {
      label: "SLA compliance",
      value: metrics.slaCompliancePercent !== null ? `${metrics.slaCompliancePercent}%` : "Not available",
      change: "Target 95%+",
      trend: (metrics.slaCompliancePercent ?? 0) >= 95 ? ("up" as const) : ("down" as const),
    },
    {
      label: "Employee utilisation",
      value: metrics.employeeUtilisationPercent !== null ? `${metrics.employeeUtilisationPercent}%` : "Not available",
      change: "Capacity metrics",
      trend: "flat" as const,
    },
    {
      label: "Outstanding invoices",
      value: formatMoney(metrics.outstanding.amount, metrics.outstanding.currencyCode || currency),
      change: Number(metrics.outstanding.amount) > 0 ? "Pending collection" : "0 outstanding",
      trend: Number(metrics.outstanding.amount) > 0 ? ("down" as const) : ("flat" as const),
    },
  ];

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow={`Tenant Admin · ${tenant.name}`}
        title="Operations overview"
        description="Monitor client delivery, workforce capacity, billing follow-up, and organisation readiness."
      />
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Tenant administration metrics"
      >
        {cards.map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle
                className="size-[18px] text-warning"
                aria-hidden="true"
              />
              At-risk work and deadlines
            </CardTitle>
            <CardDescription>
              Delivery signals that need a manager or administrator response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-6 text-center text-sm text-muted-foreground">
              No at-risk work found.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2
                className="size-[18px] text-primary"
                aria-hidden="true"
              />
              Organisation setup
            </CardTitle>
            <CardDescription>
              Complete operational setup tasks before expanding delivery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-6 text-center text-sm text-muted-foreground">
              Organisation setup is complete.
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-[30px] lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock
                className="size-[18px] text-primary"
                aria-hidden="true"
              />
              Upcoming deadlines
            </CardTitle>
            <CardDescription>
              Client milestones and operational follow-ups in the next delivery window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-6 text-center text-sm text-muted-foreground">
              No upcoming deadlines found.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Changes requiring a traceable follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent activity recorded.</p>
            ) : (
              <ol className="flex flex-col gap-4 text-sm">
                {recentActivity.map((item, idx) => (
                  <li key={idx}>
                    <strong>{item.actor}</strong> {item.action} · {relativeTime(item.createdAt)}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TenantOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-[30px]" aria-busy="true">
      <div className="h-16 w-1/3 animate-pulse rounded bg-muted" />
      <div className="grid h-36 grid-cols-2 gap-4 rounded bg-muted xl:grid-cols-3 animate-pulse" />
      <div className="grid h-48 grid-cols-2 gap-4 rounded bg-muted animate-pulse" />
    </div>
  );
}
