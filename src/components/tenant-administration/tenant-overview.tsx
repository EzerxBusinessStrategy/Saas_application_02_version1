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
import { EmptyState } from "@/components/shared/empty-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { OrganisationSetupFloat } from "@/components/tenant-administration/organisation-setup-float";
import {
  DashboardKpiSection,
  ExecutiveKpiCard,
  TenantDashboardKpiSkeleton,
} from "@/components/tenant-administration/tenant-dashboard-kpi";
import { TenantDashboardCalendarWidget } from "@/components/tenant-administration/tenant-dashboard-calendar-widget";
import { TenantDashboardActivity } from "@/components/tenant-administration/tenant-dashboard-activity";
import { compactPeriodLabel } from "@/components/tenant-administration/dashboard-activity";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { listTenantAdminTaskOptions } from "@/features/operations/api/operations-api";
import { formatDashboardMoney } from "@/lib/dashboard-money";
import { getTimeOfDayGreeting } from "@/lib/dashboard-greeting";

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

function formatUpdatedAt(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function countDueThisWeek(
  deadlines: DashboardResponse["upcomingDeadlines"],
): number {
  const now = Date.now();
  const weekAhead = now + 7 * 86_400_000;
  return deadlines.filter((item) => {
    const due = new Date(item.dueAt).getTime();
    return due >= now && due <= weekAhead;
  }).length;
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

  const { metrics, financialYear, financialDataAvailable, recentActivity, tenant, organisationSetup, upcomingDeadlines, period } = data;
  const currency = tenant.currencyCode || "INR";
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
  const dueThisWeek = countDueThisWeek(upcomingDeadlines);
  const salesMoney = metrics.totalSales
    ? formatDashboardMoney(metrics.totalSales.amount, metrics.totalSales.currencyCode || currency)
    : null;
  const outstandingMoney = metrics.outstanding
    ? formatDashboardMoney(metrics.outstanding.amount, metrics.outstanding.currencyCode || currency)
    : null;
  const outstandingAmount = Number(metrics.outstanding?.amount ?? 0);
  const salesAmount = Number(metrics.totalSales?.amount ?? 0);

  function applyEmployeeFilter(nextEmployeeId: string) {
    setDraftEmployeeId(nextEmployeeId);
    if (invalidRange) return;
    setApplied({
      from: fromValue,
      to: toValue,
      clientId: clientValue || undefined,
      employeeId: nextEmployeeId || undefined,
    });
  }

  return (
    <div className="relative flex flex-col gap-8">
      {!setupComplete ? <OrganisationSetupFloat organisationSetup={organisationSetup} /> : null}

      <PageHeader
        eyebrow={`${getTimeOfDayGreeting()}, ${profileName.trim().split(/\s+/)[0] || profileName}`}
        title="Dashboard"
        description="Monitor tasks, clients and business performance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="dashboard-period-preset">
              Dashboard period
            </label>
            <Select
              id="dashboard-period-preset"
              className="min-w-[11rem]"
              aria-label="Dashboard period"
              value={selectValue}
              onChange={(event) => applyPreset(event.target.value as DashboardPreset)}
            >
              <option value="last_30_days">Last 30 days</option>
              <option value="this_month">This month</option>
              <option value="financial_year" disabled={!financialYear}>
                Current financial year
              </option>
              <option value="custom">Custom range</option>
            </Select>
            <label className="sr-only" htmlFor="dashboard-employee-filter">
              Dashboard employee filter
            </label>
            <Select
              id="dashboard-employee-filter"
              className="min-w-[11rem]"
              aria-label="Filter dashboard by employee"
              value={employeeValue}
              onChange={(event) => applyEmployeeFilter(event.target.value)}
            >
              <option value="">All employees</option>
              {(filterOptionsQuery.data?.employees ?? [])
                .filter((employee) => employee.employmentStatus === "active")
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
            </Select>
            <span className="text-xs text-muted-foreground">
              {isFetching ? "Updating…" : `Updated ${formatUpdatedAt(new Date())}`}
            </span>
          </div>
        }
      />

      <FilterToolbar
        activeFilterCount={activeFilterCount}
        onClear={resetPeriod}
        filterGridClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        trailing={
          <Button type="button" disabled={!filtersDirty || invalidRange || isFetching} onClick={applyDraft}>
            Apply filters
          </Button>
        }
      >
        <label className="text-sm font-medium">
          Period preset
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
          <DatePicker
            className="mt-1"
            aria-label="Dashboard from date"
            value={fromValue}
            onChange={(value) => {
              setPreset("custom");
              setDraftFrom(value);
            }}
          />
        </label>
        <label className="text-sm font-medium">
          To
          <DatePicker
            className="mt-1"
            aria-label="Dashboard to date"
            value={toValue}
            onChange={(value) => {
              setPreset("custom");
              setDraftTo(value);
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

      <div className="flex flex-col gap-8" aria-label="Tenant administration metrics" aria-busy={isFetching}>
        <DashboardKpiSection title="Task overview">
          <ExecutiveKpiCard
            label="Open tasks"
            value={metrics.openTasks.toString()}
            trend={metrics.openTasks > 0 ? `In ${periodLabel}` : "None in this period"}
            trendDirection={metrics.openTasks > 0 ? "up" : "flat"}
            detail={dueThisWeek > 0 ? `${dueThisWeek} due this week` : undefined}
            icon={ClipboardList}
            tone="info"
            href={openTasksHref}
            ariaLabel={`View ${metrics.openTasks} open tasks for this period`}
          />
          <ExecutiveKpiCard
            label="Completed tasks"
            value={metrics.completedTasks.toString()}
            trend={metrics.completedTasks > 0 ? `In ${periodLabel}` : "None in this period"}
            trendDirection={metrics.completedTasks > 0 ? "up" : "flat"}
            icon={CheckCircle2}
            tone="success"
            href={completedTasksHref}
            ariaLabel={`View ${metrics.completedTasks} completed tasks for this period`}
          />
          <ExecutiveKpiCard
            label="Overdue tasks"
            value={String(metrics.overdueTasks ?? 0)}
            trend={metrics.overdueTasks > 0 ? "Past due and still open" : "Nothing overdue"}
            trendDirection={metrics.overdueTasks > 0 ? "down" : "neutral"}
            icon={AlertCircle}
            tone={metrics.overdueTasks > 0 ? "danger" : "success"}
            href={overdueTasksHref}
            ariaLabel={`View ${metrics.overdueTasks} overdue tasks`}
          />
        </DashboardKpiSection>

        <DashboardKpiSection title="Business overview">
          <ExecutiveKpiCard
            label="Active clients"
            value={metrics.activeClients.toString()}
            trend={
              metrics.activeClients > 0
                ? `${metrics.activeClients} active in ${periodLabel}`
                : "None in this period"
            }
            trendDirection={metrics.activeClients > 0 ? "up" : "flat"}
            icon={Users}
            tone="neutral"
          />
          <ExecutiveKpiCard
            label="Total sales"
            value={salesMoney?.display ?? "Not available"}
            valueTitle={salesMoney && salesMoney.display !== salesMoney.exact ? salesMoney.exact : undefined}
            trend={salesAmount > 0 ? `Invoiced in ${periodLabel}` : "No sales in this period"}
            trendDirection={salesAmount > 0 ? "up" : "flat"}
            icon={IndianRupee}
            tone="neutral"
          />
          <ExecutiveKpiCard
            label="Outstanding"
            value={outstandingMoney?.display ?? "Not available"}
            valueTitle={
              outstandingMoney && outstandingMoney.display !== outstandingMoney.exact
                ? outstandingMoney.exact
                : undefined
            }
            trend={
              outstandingAmount > 0
                ? "Awaiting payment in this period"
                : salesAmount > 0
                  ? "Fully collected in this period"
                  : "No outstanding balance"
            }
            trendDirection={outstandingAmount > 0 ? "down" : "neutral"}
            detail={outstandingAmount > 0 ? "Unpaid invoice balance" : undefined}
            icon={Wallet}
            tone={outstandingAmount > 0 ? "warning" : "success"}
          />
        </DashboardKpiSection>
      </div>
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
        <TenantDashboardActivity
          events={recentActivity}
          periodLabel={compactPeriodLabel(period.from, period.to)}
          periodFrom={period.from}
          periodTo={period.to}
        />
      </section>
    </div>
  );
}

function TenantOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <div className="h-24 animate-pulse rounded-[14px] bg-muted" />
      <div className="h-16 animate-pulse rounded-[14px] bg-muted" />
      <TenantDashboardKpiSkeleton />
      <div className="h-48 animate-pulse rounded-[14px] bg-muted" />
    </div>
  );
}
