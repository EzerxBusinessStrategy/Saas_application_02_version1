"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
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
  financialDataAvailable: boolean;
  financialDataUnavailableReason: string | null;
  metrics: {
    activeClients: number;
    totalSales: {
      amount: string;
      currencyCode: string;
    } | null;
    openTasks: number;
    outstanding: {
      amount: string;
      currencyCode: string;
    } | null;
  };
  recentActivity: {
    id: string;
    action: string;
    label: string;
    resourceType: string;
    resourceId: string | null;
    result: string;
    metadata: Record<string, unknown>;
    actor: string;
    createdAt: string;
  }[];
  organisationSetup: {
    completed: number;
    total: number;
    completionPercent: number;
    items: {
      key: string;
      label: string;
      description: string;
      completed: boolean;
      destination: string | null;
    }[];
  };
  upcomingDeadlines: {
    id: string;
    taskId: string;
    taskTitle: string;
    clientId: string;
    clientName: string;
    dueAt: string;
    priority: string;
    status: string;
    workGroupName: string | null;
    assigneeCount: number;
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

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
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

function timeRemaining(value: string): string {
  const minutes = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} remaining`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

function humanise(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  const { metrics, financialYear, financialDataAvailable, recentActivity: rawRecentActivity, tenant, organisationSetup, upcomingDeadlines } = data;
  const currency = tenant.currencyCode || "INR";
  const recentActivity = rawRecentActivity.map((item) => ({ ...item, action: item.label }));
  const incompleteSetup = organisationSetup.items.filter((item) => !item.completed);

  const financialYearText = financialYear
    ? `${financialYear.label} (${formatDate(financialYear.startsOn)} – ${formatDate(financialYear.endsOn)})`
    : null;

  const cards = [
    {
      label: "Active clients",
      value: metrics.activeClients.toString(),
      change: metrics.activeClients > 0 ? `+${metrics.activeClients} active` : "0 active clients",
      trend: metrics.activeClients > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Total sales",
      value: metrics.totalSales
        ? formatMoney(metrics.totalSales.amount, metrics.totalSales.currencyCode || currency)
        : "Not available",
      change: financialYear ? financialYear.label : "Financial year unconfigured",
      trend: metrics.totalSales && Number(metrics.totalSales.amount) > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Open tasks",
      value: metrics.openTasks.toString(),
      change: metrics.openTasks > 0 ? "Awaiting completion" : "No open tasks",
      trend: metrics.openTasks > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Outstanding invoices",
      value: metrics.outstanding
        ? formatMoney(metrics.outstanding.amount, metrics.outstanding.currencyCode || currency)
        : "Not available",
      change: metrics.outstanding && Number(metrics.outstanding.amount) > 0 ? "Pending collection" : "0 outstanding",
      trend: metrics.outstanding && Number(metrics.outstanding.amount) > 0 ? ("down" as const) : ("flat" as const),
    },
  ];

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow={`Tenant Admin · ${tenant.name}`}
        title="Operations overview"
        description={
          financialYearText
            ? `Current Financial Year: ${financialYearText}`
            : "Monitor client delivery, workforce capacity, billing follow-up, and organisation readiness."
        }
      />

      {!financialDataAvailable ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400" role="alert">
          <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Current financial year not configured</p>
            <p className="text-sm">Current financial year is not configured for this tenant. Please contact the Super Admin.</p>
          </div>
        </div>
      ) : null}

      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
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
      <section className="grid gap-[30px] xl:grid-cols-[0.95fr_1.05fr]">
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
            {incompleteSetup.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 size-6 text-primary" aria-hidden="true" />
                <p className="font-medium">Organisation setup is complete.</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium">
                    {organisationSetup.completed} of {organisationSetup.total} completed
                  </p>
                  <ProgressBar value={organisationSetup.completionPercent} />
                </div>
                <div className="divide-y">
                  {incompleteSetup.slice(0, 4).map((item) => (
                    <SetupItem key={item.key} item={item} />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
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
            {upcomingDeadlines.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No upcoming deadlines found.
              </div>
            ) : (
              <ol className="flex flex-col gap-4 text-sm">
                {upcomingDeadlines.map((item) => (
                  <li key={item.id} className="rounded-md border p-3">
                    <p className="font-medium">{item.taskTitle}</p>
                    <p className="text-muted-foreground">{item.clientName}</p>
                    <p className="mt-2">
                      Due {formatDateTime(item.dueAt)} - {timeRemaining(item.dueAt)}
                    </p>
                    <p className="text-muted-foreground">
                      Assigned to: {item.workGroupName ?? (item.assigneeCount > 0 ? `${item.assigneeCount} employee${item.assigneeCount === 1 ? "" : "s"}` : "Unassigned")}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {humanise(item.priority)} priority - {humanise(item.status)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
      <section>
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
                {recentActivity.map((item) => (
                  <li key={item.id}>
                    <strong>{item.actor}</strong> {item.action} - {relativeTime(item.createdAt)}
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

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${width}% complete`} aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  );
}

function SetupItem({
  item,
}: {
  item: {
    label: string;
    description: string;
    destination: string | null;
  };
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 text-sm">
      <div>
        <p className="font-medium">{item.label}</p>
        <p className="text-muted-foreground">{item.description}</p>
      </div>
      {item.destination ? (
        <a href={item.destination} className="shrink-0 text-primary hover:underline">
          Open
        </a>
      ) : null}
    </div>
  );
}

function TenantOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-[30px]" aria-busy="true">
      <div className="h-16 w-1/3 animate-pulse rounded bg-muted" />
      <div className="grid h-36 grid-cols-2 gap-4 rounded bg-muted lg:grid-cols-5 animate-pulse" />
      <div className="grid h-48 grid-cols-2 gap-4 rounded bg-muted animate-pulse" />
    </div>
  );
}
