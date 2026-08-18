"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  RefreshCw,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { DashboardGreetingBanner } from "@/components/shared/dashboard-greeting-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { MetricCard } from "@/components/shared/metric-card";
import { OrganisationSetupFloat } from "@/components/tenant-administration/organisation-setup-float";
import { TenantDashboardCalendarWidget } from "@/components/tenant-administration/tenant-dashboard-calendar-widget";
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
import { listTenantAdminTaskOptions } from "@/features/operations/api/operations-api";
import { formatDashboardMonthLabel } from "@/lib/dashboard-greeting";

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
    completedTasks: number;
    overdueTasks: number;
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

type AuthenticatedProfile = {
  readonly user: {
    readonly displayName: string;
  };
};

export function TenantAdministrationOverview() {
  const [applied, setApplied] = useState<{ from?: string; to?: string; clientId?: string; employeeId?: string }>({});
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [draftClientId, setDraftClientId] = useState("");
  const [draftEmployeeId, setDraftEmployeeId] = useState("");
  const [preset, setPreset] = useState<DashboardPreset>("custom");
  const [profileName, setProfileName] = useState("Tenant Admin");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/me?portal=tenant", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as AuthenticatedProfile) : null))
      .then((response) => {
        if (response?.user.displayName) setProfileName(response.user.displayName);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const filterOptionsQuery = useQuery({
    queryKey: ["tenant-dashboard-filter-options"],
    queryFn: listTenantAdminTaskOptions,
    staleTime: 60_000,
  });

  const query = useQuery<DashboardResponse>({
    queryKey: [
      "tenant-operations-overview",
      applied.from ?? "",
      applied.to ?? "",
      applied.clientId ?? "",
      applied.employeeId ?? "",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (applied.from && applied.to) {
        params.set("from", applied.from);
        params.set("to", applied.to);
      }
      if (applied.clientId) params.set("clientId", applied.clientId);
      if (applied.employeeId) params.set("employeeId", applied.employeeId);
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
  const clientValue = draftClientId || applied.clientId || "";
  const employeeValue = draftEmployeeId || applied.employeeId || "";
  const incompleteRange = Boolean(fromValue) !== Boolean(toValue);
  const invertedRange = Boolean(fromValue && toValue && fromValue > toValue);
  const oversizedRange = Boolean(fromValue && toValue && isoDateDiffDays(fromValue, toValue) > 731);
  const invalidRange = incompleteRange || invertedRange || oversizedRange;
  const filtersDirty =
    fromValue !== period.from ||
    toValue !== period.to ||
    clientValue !== (applied.clientId ?? "") ||
    employeeValue !== (applied.employeeId ?? "");
  const periodLabel = periodSourceLabel(period, financialYear);
  const activeFilterCount =
    (applied.from && applied.to ? 1 : 0) +
    (applied.clientId ? 1 : 0) +
    (applied.employeeId ? 1 : 0);
  const selectValue: DashboardPreset =
    draftFrom === null && draftTo === null
      ? period.source === "query"
        ? "custom"
        : period.source
      : preset;
  const hasFilteredRecords =
    metrics.activeClients > 0 ||
    metrics.openTasks > 0 ||
    metrics.completedTasks > 0 ||
    metrics.overdueTasks > 0 ||
    Number(metrics.totalSales?.amount ?? 0) > 0 ||
    upcomingDeadlines.length > 0 ||
    recentActivity.length > 0;

  function applyRange(from: string, to: string, nextPreset: DashboardPreset) {
    if (!from || !to || from > to || isoDateDiffDays(from, to) > 731) return;
    setDraftFrom(from);
    setDraftTo(to);
    setPreset(nextPreset);
    setApplied((current) => ({
      from,
      to,
      clientId: current.clientId,
      employeeId: current.employeeId,
    }));
  }

  function applyDraft() {
    if (invalidRange) return;
    setApplied({
      from: fromValue,
      to: toValue,
      clientId: clientValue || undefined,
      employeeId: employeeValue || undefined,
    });
    setDraftFrom(fromValue);
    setDraftTo(toValue);
    setPreset("custom");
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
    setDraftClientId("");
    setDraftEmployeeId("");
    setPreset("custom");
    setApplied({});
  }

  const openTasksHref = `/admin/open-tasks?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`;
  const completedTasksHref = `/admin/completed-tasks?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`;
  const overdueTasksHref = openTasksHref;
  const greetingSubtitle = `${formatDashboardMonthLabel()} · ${periodLabel} · ${metrics.openTasks + metrics.completedTasks} tasks · ${metrics.openTasks} open · ${metrics.overdueTasks ?? 0} overdue`;

  const cards = [
    {
      label: "Open tasks",
      value: metrics.openTasks.toString(),
      change: metrics.openTasks > 0 ? "Due or created in this period" : "None in this period",
      trend: metrics.openTasks > 0 ? ("up" as const) : ("flat" as const),
      href: openTasksHref,
      ariaLabel: `View ${metrics.openTasks} open tasks for this period`,
      icon: ClipboardList,
    },
    {
      label: "Completed tasks",
      value: metrics.completedTasks.toString(),
      change: metrics.completedTasks > 0 ? "Completed in this period" : "None in this period",
      trend: metrics.completedTasks > 0 ? ("up" as const) : ("flat" as const),
      href: completedTasksHref,
      ariaLabel: `View ${metrics.completedTasks} completed tasks for this period`,
      icon: CheckCircle2,
    },
    {
      label: "Overdue tasks",
      value: String(metrics.overdueTasks ?? 0),
      change: metrics.overdueTasks > 0 ? "Past due and still open" : "None overdue",
      trend: metrics.overdueTasks > 0 ? ("down" as const) : ("flat" as const),
      href: overdueTasksHref,
      ariaLabel: `View ${metrics.overdueTasks} overdue tasks`,
      icon: AlertCircle,
    },
    {
      label: "Active clients",
      value: metrics.activeClients.toString(),
      change: metrics.activeClients > 0 ? "With work or billing in this period" : "None in this period",
      trend: metrics.activeClients > 0 ? ("up" as const) : ("flat" as const),
      icon: Users,
    },
    {
      label: "Total sales",
      value: metrics.totalSales
        ? formatMoney(metrics.totalSales.amount, metrics.totalSales.currencyCode || currency)
        : "Not available",
      change: "Invoices issued in this period",
      trend: metrics.totalSales && Number(metrics.totalSales.amount) > 0 ? ("up" as const) : ("flat" as const),
      icon: IndianRupee,
    },
    {
      label: "Outstanding invoices",
      value: metrics.outstanding
        ? formatMoney(metrics.outstanding.amount, metrics.outstanding.currencyCode || currency)
        : "Not available",
      change: metrics.outstanding && Number(metrics.outstanding.amount) > 0 ? "Unpaid in this period" : "0 outstanding",
      trend: metrics.outstanding && Number(metrics.outstanding.amount) > 0 ? ("down" as const) : ("flat" as const),
      icon: Wallet,
    },
  ];

  return (
    <div className="relative flex flex-col gap-[30px]">
      {!setupComplete ? <OrganisationSetupFloat organisationSetup={organisationSetup} /> : null}

      <DashboardGreetingBanner
        userName={profileName}
        organizationName={tenant.name}
        subtitle={greetingSubtitle}
      />

      <FilterToolbar
        activeFilterCount={activeFilterCount}
        onClear={resetPeriod}
        trailing={
          <Button type="button" disabled={!filtersDirty || invalidRange || isFetching} onClick={applyDraft}>
            Apply filters
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
        <label className="text-sm font-medium">
          Client
          <Select
            className="mt-1"
            aria-label="Filter dashboard by client"
            value={clientValue}
            onChange={(event) => setDraftClientId(event.target.value)}
          >
            <option value="">All clients</option>
            {(filterOptionsQuery.data?.clients ?? []).map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-medium">
          Employee
          <Select
            className="mt-1"
            aria-label="Filter dashboard by employee"
            value={employeeValue}
            onChange={(event) => setDraftEmployeeId(event.target.value)}
          >
            <option value="">All employees</option>
            {(filterOptionsQuery.data?.employees ?? [])
              .filter((employee) => employee.employmentStatus === "active")
              .map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
          </Select>
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
        className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Tenant administration metrics"
        aria-busy={isFetching}
      >
        {cards.map((metric, index) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            icon={metric.icon}
            variant="elevated"
            animationIndex={index}
            href={"href" in metric ? metric.href : undefined}
            ariaLabel={"ariaLabel" in metric ? metric.ariaLabel : undefined}
          />
        ))}
      </section>
      {!hasFilteredRecords ? (
        <EmptyState
          title="No matching records in this date range"
          description="Try another period or clear the client and employee filters."
        />
      ) : null}

      <TenantDashboardCalendarWidget
        clientId={applied.clientId}
        employeeId={applied.employeeId}
      />

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-[18px] text-primary" aria-hidden="true" />
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
              <div className="flex gap-4 overflow-x-auto pb-2">
                {upcomingDeadlines.map((item) => (
                  <article
                    key={item.id}
                    className="min-w-[17rem] max-w-[17rem] shrink-0 rounded-md border p-4 text-sm"
                  >
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
                  </article>
                ))}
              </div>
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

function TenantOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-[30px]" aria-busy="true">
      <div className="h-16 w-1/3 animate-pulse rounded bg-muted" />
      <div className="grid h-36 grid-cols-2 gap-4 rounded bg-muted lg:grid-cols-5 animate-pulse" />
      <div className="grid h-48 grid-cols-2 gap-4 rounded bg-muted animate-pulse" />
    </div>
  );
}
