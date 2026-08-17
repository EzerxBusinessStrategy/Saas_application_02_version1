"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
  period: {
    from: string;
    to: string;
    source: "query" | "financial_year" | "last_30_days";
  };
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
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Overdue";
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} remaining`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

function humanise(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLocalIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addLocalIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function isoDateDiffDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function periodSourceLabel(
  period: DashboardResponse["period"],
  financialYear: DashboardResponse["financialYear"],
): string {
  switch (period.source) {
    case "financial_year":
      return "current financial year";
    case "last_30_days":
      return "last 30 days";
    case "query":
      if (
        financialYear &&
        period.from === financialYear.startsOn &&
        period.to === financialYear.endsOn
      ) {
        return "current financial year";
      }
      return "selected dates";
    default: {
      const exhaustive: never = period.source;
      return exhaustive;
    }
  }
}

type DashboardPreset = "custom" | "this_month" | "last_30_days" | "financial_year";

export function TenantAdministrationOverview() {
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [preset, setPreset] = useState<DashboardPreset>("custom");
  const query = useQuery<DashboardResponse>({
    queryKey: ["tenant-operations-overview", applied.from ?? "", applied.to ?? ""],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (applied.from && applied.to) {
        params.set("from", applied.from);
        params.set("to", applied.to);
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/admin/operations-overview${suffix}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load operations overview");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 10000,
  });
  const { data, isLoading, isError, isFetching, refetch } = query;

  if (isLoading && !data) {
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

  const { metrics, financialYear, financialDataAvailable, recentActivity: rawRecentActivity, tenant, organisationSetup, upcomingDeadlines, period } = data;
  const currency = tenant.currencyCode || "INR";
  const recentActivity = rawRecentActivity.map((item) => ({ ...item, action: item.label }));
  const setupComplete = organisationSetup.completed === organisationSetup.total;
  const fromValue = draftFrom ?? period.from;
  const toValue = draftTo ?? period.to;
  const incompleteRange = Boolean(fromValue) !== Boolean(toValue);
  const invertedRange = Boolean(fromValue && toValue && fromValue > toValue);
  const oversizedRange = Boolean(fromValue && toValue && isoDateDiffDays(fromValue, toValue) > 731);
  const invalidRange = incompleteRange || invertedRange || oversizedRange;
  const filtersDirty = fromValue !== period.from || toValue !== period.to;
  const periodLabel = periodSourceLabel(period, financialYear);
  const selectValue: DashboardPreset =
    draftFrom === null && draftTo === null
      ? period.source === "query"
        ? "custom"
        : period.source
      : preset;
  const hasFilteredRecords =
    metrics.activeClients > 0 ||
    metrics.openTasks > 0 ||
    Number(metrics.totalSales?.amount ?? 0) > 0 ||
    upcomingDeadlines.length > 0 ||
    recentActivity.length > 0;

  function applyRange(from: string, to: string, nextPreset: DashboardPreset) {
    if (!from || !to || from > to || isoDateDiffDays(from, to) > 731) return;
    setDraftFrom(from);
    setDraftTo(to);
    setPreset(nextPreset);
    setApplied({ from, to });
  }

  function applyDraft() {
    applyRange(fromValue, toValue, "custom");
  }

  function applyPreset(next: DashboardPreset) {
    switch (next) {
      case "custom":
        setPreset("custom");
        return;
      case "financial_year":
        if (!financialYear) return;
        applyRange(financialYear.startsOn, financialYear.endsOn, "financial_year");
        return;
      case "last_30_days": {
        const today = toLocalIsoDate(new Date());
        applyRange(addLocalIsoDays(today, -29), today, "last_30_days");
        return;
      }
      case "this_month": {
        const today = toLocalIsoDate(new Date());
        const monthStart = `${today.slice(0, 8)}01`;
        const monthEndDate = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0);
        applyRange(monthStart, toLocalIsoDate(monthEndDate), "this_month");
        return;
      }
      default: {
        const exhaustive: never = next;
        return exhaustive;
      }
    }
  }

  function resetPeriod() {
    setDraftFrom(null);
    setDraftTo(null);
    setPreset("custom");
    setApplied({});
  }

  const cards = [
    {
      label: "Active clients",
      value: metrics.activeClients.toString(),
      change: metrics.activeClients > 0 ? "With work or billing in this period" : "None in this period",
      trend: metrics.activeClients > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Total sales",
      value: metrics.totalSales
        ? formatMoney(metrics.totalSales.amount, metrics.totalSales.currencyCode || currency)
        : "Not available",
      change: "Invoices issued in this period",
      trend: metrics.totalSales && Number(metrics.totalSales.amount) > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Open tasks",
      value: metrics.openTasks.toString(),
      change: metrics.openTasks > 0 ? "Due or created in this period" : "None in this period",
      trend: metrics.openTasks > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Outstanding invoices",
      value: metrics.outstanding
        ? formatMoney(metrics.outstanding.amount, metrics.outstanding.currencyCode || currency)
        : "Not available",
      change: metrics.outstanding && Number(metrics.outstanding.amount) > 0 ? "Unpaid in this period" : "0 outstanding",
      trend: metrics.outstanding && Number(metrics.outstanding.amount) > 0 ? ("down" as const) : ("flat" as const),
    },
  ];

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow={`Tenant Admin · ${tenant.name}`}
        title="Operations overview"
        description={`Showing ${formatLocalIsoDate(period.from)} – ${formatLocalIsoDate(period.to)} (${periodLabel}).`}
      />

      <FilterToolbar
        activeFilterCount={applied.from && applied.to ? 1 : 0}
        onClear={resetPeriod}
        trailing={
          <Button type="button" disabled={!filtersDirty || invalidRange || isFetching} onClick={applyDraft}>
            Apply dates
          </Button>
        }
      >
        <label className="text-sm font-medium">
          Period
          <Select
            className="mt-1"
            aria-label="Dashboard date preset"
            value={selectValue}
            onChange={(event) => applyPreset(event.target.value as DashboardPreset)}
          >
            <option value="custom">Custom range</option>
            <option value="this_month">This month</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="financial_year" disabled={!financialYear}>
              Current financial year
            </option>
          </Select>
        </label>
        <label className="text-sm font-medium">
          From
          <Input
            className="mt-1"
            type="date"
            aria-label="Dashboard from date"
            value={fromValue}
            onChange={(event) => {
              setPreset("custom");
              setDraftFrom(event.target.value);
            }}
          />
        </label>
        <label className="text-sm font-medium">
          To
          <Input
            className="mt-1"
            type="date"
            aria-label="Dashboard to date"
            value={toValue}
            onChange={(event) => {
              setPreset("custom");
              setDraftTo(event.target.value);
            }}
          />
        </label>
        {invalidRange ? (
          <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-1">
            {incompleteRange
              ? "Choose both a start and end date."
              : invertedRange
                ? "The end date must be on or after the start date."
                : "The range cannot exceed 731 days."}
          </p>
        ) : null}
      </FilterToolbar>

      {!financialDataAvailable ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400" role="alert">
          <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Current financial year not configured</p>
            <p className="text-sm">Sales still use the selected dates. Ask Super Admin to configure the financial year if you want that default range.</p>
          </div>
        </div>
      ) : null}

      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Tenant administration metrics"
        aria-busy={isFetching}
      >
        {cards.map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      {!hasFilteredRecords ? (
        <EmptyState
          title="No matching records in this date range"
          description="Try another period. Organisation setup below is current and is not date filtered."
        />
      ) : null}
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
            {setupComplete ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 size-7 text-emerald-600" aria-hidden="true" />
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Setup completed</p>
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
                  {organisationSetup.items.map((item) => (
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
              Deadlines in this period
            </CardTitle>
            <CardDescription>
              Open tasks due between {formatLocalIsoDate(period.from)} and {formatLocalIsoDate(period.to)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length === 0 ? (
              <EmptyState
                title="No deadlines in this period"
                description="Open tasks with due dates in the selected range will appear here."
              />
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
            <CardTitle>Activity in this period</CardTitle>
            <CardDescription>
              Traceable changes between {formatLocalIsoDate(period.from)} and {formatLocalIsoDate(period.to)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EmptyState
                title="No activity in this period"
                description="Tenant audit events in the selected range will appear here."
              />
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
    completed: boolean;
  };
}) {
  return (
    <div className="flex items-start gap-3 py-3 text-sm">
      <span
        className={`mt-1 flex size-3 shrink-0 items-center justify-center rounded-full ${
          item.completed ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
        }`}
        aria-hidden="true"
      >
        {item.completed ? <CheckCircle2 className="size-3 text-white" strokeWidth={3} /> : null}
      </span>
      <div>
        <p className="font-medium">{item.label}</p>
        <p className="text-muted-foreground">{item.description}</p>
      </div>
      <span className={`ml-auto shrink-0 text-xs font-medium ${item.completed ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
        {item.completed ? "Created" : "Pending"}
      </span>
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
