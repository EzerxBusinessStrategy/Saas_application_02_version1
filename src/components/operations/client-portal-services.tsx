"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DatePicker, parseIsoDate } from "@/components/shared/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { SearchableFilterSelect } from "@/components/shared/searchable-filter-select";
import type { ClientPortalDashboard } from "@/features/client-portal/api/client-portal-dashboard-api";
import { createClientServiceComment } from "@/features/client-portal/api/client-portal-service-comments-api";
import {
  formatDiscountPercent,
  formatMonthLabel,
  summarizeClientServiceSchedule,
} from "@/features/client-portal/client-service-pricing";
import {
  clientServiceTitles,
  clientTaskListStatus,
  employeeInitials,
  formatClientDate,
  formatClientMoney,
  formatClientMoneyCompact,
  humanizeClientStatus,
  isClientTaskDueSoon,
  nextOpenClientTask,
} from "@/components/operations/client-portal-display";
import { cn } from "@/lib/utils";

type ClientPortalService = ClientPortalDashboard["services"][number];
type DrawerTab = "overview" | "tasks" | "billing";
type ClientDashboardPreset = "custom" | "this_month" | "last_30_days" | "upcoming_year";

const COMPACT_SERVICE_LIMIT = 3;

export type ClientPortalPeriodControls = {
  fromValue: string;
  toValue: string;
  selectValue: ClientDashboardPreset;
  invalidRange: boolean;
  incompleteRange: boolean;
  invertedRange: boolean;
  filtersDirty: boolean;
  isFetching: boolean;
  activeFilterCount: number;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPresetChange: (value: ClientDashboardPreset) => void;
  onApply: () => void;
  onClear: () => void;
};

export function ClientServices({
  services,
  compact = false,
  currencyCode = "INR",
  period,
}: {
  services: ClientPortalDashboard["services"];
  compact?: boolean;
  currencyCode?: string;
  period?: ClientPortalPeriodControls;
}) {
  const [drawerServiceId, setDrawerServiceId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [messageServiceId, setMessageServiceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");

  const source = compact ? services.slice(0, COMPACT_SERVICE_LIMIT) : services;
  const statusOptions = useMemo(() => uniqueStatuses(services), [services]);
  const assigneeOptions = useMemo(() => uniqueAssignees(services), [services]);
  const visible = compact
    ? source
    : source.filter((service) => matchesServiceFilters(service, search, status, assignee));
  const summary = useMemo(() => summarizePortfolio(visible, currencyCode), [currencyCode, visible]);
  const drawerService = services.find((service) => service.id === drawerServiceId) ?? null;
  const messageService = services.find((service) => service.id === messageServiceId) ?? null;
  const activeFilterCount =
    (search ? 1 : 0) + (status ? 1 : 0) + (assignee ? 1 : 0) + (period?.activeFilterCount ?? 0);

  function openDrawer(serviceId: string, tab: DrawerTab) {
    setDrawerTab(tab);
    setDrawerServiceId(serviceId);
  }

  function resetLocalFilters() {
    setSearch("");
    setStatus("");
    setAssignee("");
    period?.onClear();
  }

  return (
    <>
      {compact ? (
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Your services</CardTitle>
                <CardDescription>{services.length} active</CardDescription>
              </div>
              {services.length ? (
                <Link href="/client/services" className="shrink-0 text-sm font-medium text-primary">
                  View all
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5">
            {visible.length ? (
              <ul className="grid gap-3">
                {visible.map((service) => (
                  <li key={service.id}>
                    <ServicePortfolioCard
                      service={service}
                      compact
                      onOpenDetails={() => openDrawer(service.id, "overview")}
                      onOpenTasks={() => openDrawer(service.id, "tasks")}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No active services"
                description="Tick services from Requests. After the tenant accepts, they appear here with dates and prices."
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {period ? (
            <FilterToolbar
              search={{
                value: search,
                onChange: setSearch,
                label: "Search services",
                placeholder: "Search services...",
              }}
              activeFilterCount={activeFilterCount}
              onClear={resetLocalFilters}
              trailing={<CompactDateRangeControl period={period} />}
              filterGridClassName="grid gap-2 sm:grid-cols-2"
            >
              <SearchableFilterSelect
                label="Status"
                ariaLabel="Filter services by status"
                value={status}
                onChange={setStatus}
                options={statusOptions}
                emptyLabel="All status"
                placeholder="Search status..."
              />
              <SearchableFilterSelect
                label="Assigned to"
                ariaLabel="Filter services by assignee"
                value={assignee}
                onChange={setAssignee}
                options={assigneeOptions}
                emptyLabel="All team members"
                placeholder="Search team members..."
              />
            </FilterToolbar>
          ) : null}
          <PortfolioSummary summary={summary} />
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your services
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          {visible.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {visible.map((service) => (
                <li key={service.id}>
                  <ServicePortfolioCard
                    service={service}
                    onMessage={() => setMessageServiceId(service.id)}
                    onOpenDetails={() => openDrawer(service.id, "overview")}
                    onOpenTasks={() => openDrawer(service.id, "tasks")}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={services.length ? "No services match these filters" : "No active services"}
              description={
                services.length
                  ? "Clear filters to see every purchased service again."
                  : "Tick services from Requests. After the tenant accepts, they appear here with dates and prices."
              }
            />
          )}
        </div>
      )}
      <ClientServiceDrawer
        service={drawerService}
        tab={drawerTab}
        open={Boolean(drawerService)}
        onTabChange={setDrawerTab}
        onOpenChange={(open) => {
          if (!open) setDrawerServiceId(null);
        }}
        onMessage={() => {
          if (drawerService) setMessageServiceId(drawerService.id);
        }}
      />
      <ServiceMessageDialog
        service={messageService}
        open={Boolean(messageService)}
        onOpenChange={(open) => {
          if (!open) setMessageServiceId(null);
        }}
      />
    </>
  );
}

function ServicePortfolioCard({
  service,
  compact = false,
  onMessage,
  onOpenDetails,
  onOpenTasks,
}: {
  service: ClientPortalService;
  compact?: boolean;
  onMessage?: () => void;
  onOpenDetails: () => void;
  onOpenTasks: () => void;
}) {
  const currency = service.currencyCode ?? "INR";
  const schedule = summarizeClientServiceSchedule(service.tasks, service.discountPercent);
  const { primary, secondary } = clientServiceTitles(service.engagementName, service.serviceName);
  const nextTask = nextOpenClientTask(service.tasks, service.nextDueAt);
  const thisMonth = formatBillingMonth(schedule.thisMonthKey);
  const nextMonth = formatBillingMonth(schedule.nextMonthKey);

  return (
    <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{primary}</p>
          {secondary ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{secondary}</p> : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {service.totalTasks} {service.totalTasks === 1 ? "task" : "tasks"}
            {service.openTasks > 0 ? ` · ${service.openTasks} open` : ""}
          </p>
        </div>
        <ServiceLifecycleBadge status={service.status} />
      </div>
      <ServiceProgress completed={service.completedTasks} total={service.totalTasks} percent={service.progressPercent} />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next due</dt>
          <dd className="mt-1 font-medium">{nextTask?.title ?? "None"}</dd>
          <dd className="mt-0.5 text-muted-foreground">
            {service.nextDueAt ? formatClientDate(service.nextDueAt) : "No date"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned to</dt>
          <dd className="mt-1">
            <AssignedEmployee name={service.assignedEmployeeName} />
          </dd>
        </div>
      </dl>
      <div className="mt-4 rounded-[var(--radius-control)] bg-muted/40 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Billing schedule</p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <MoneyStat label={thisMonth} amount={schedule.thisMonthDue} currency={currency} />
          <MoneyStat label={nextMonth} amount={schedule.nextMonthDue} currency={currency} />
          <MoneyStat label="Scheduled" amount={schedule.amountDue} currency={currency} />
        </dl>
      </div>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] py-1 text-left text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpenTasks}
      >
        {service.tasks.length} scheduled {service.tasks.length === 1 ? "task" : "tasks"}
        <span aria-hidden="true">→</span>
      </button>
      {compact ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onOpenDetails}>
            Details →
          </Button>
        </div>
      ) : (
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <Button size="sm" variant="outline" onClick={onMessage}>
            Message team
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenDetails}>
            Details →
          </Button>
        </div>
      )}
    </article>
  );
}

function ClientServiceDrawer({
  service,
  tab,
  open,
  onTabChange,
  onOpenChange,
  onMessage,
}: {
  service: ClientPortalService | null;
  tab: DrawerTab;
  open: boolean;
  onTabChange: (tab: DrawerTab) => void;
  onOpenChange: (open: boolean) => void;
  onMessage: () => void;
}) {
  if (!service) return null;

  const currency = service.currencyCode ?? "INR";
  const schedule = summarizeClientServiceSchedule(service.tasks, service.discountPercent);
  const { primary, secondary } = clientServiceTitles(service.engagementName, service.serviceName);
  const nextTask = nextOpenClientTask(service.tasks, service.nextDueAt);
  const tabs: ReadonlyArray<{ id: DrawerTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={primary}
        description="Service details"
        className="left-auto right-0 top-0 h-full max-h-none w-full max-w-xl translate-x-0 translate-y-0 overflow-y-auto rounded-none"
      >
        <div className="flex flex-col gap-4 pr-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{primary}</h2>
              {secondary ? <p className="mt-1 text-sm text-muted-foreground">{secondary}</p> : null}
            </div>
            <ServiceLifecycleBadge status={service.status} />
          </div>
          <div className="inline-flex w-fit rounded-md border p-0.5">
            {tabs.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={tab === item.id ? "default" : "ghost"}
                className="h-8 px-3"
                onClick={() => onTabChange(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {tab === "overview" ? (
            <div className="flex flex-col gap-4">
              <ServiceProgress
                completed={service.completedTasks}
                total={service.totalTasks}
                percent={service.progressPercent}
              />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Next due</dt>
                  <dd className="mt-1 font-medium">{nextTask?.title ?? "None"}</dd>
                  <dd className="mt-0.5 text-muted-foreground">
                    {service.nextDueAt ? formatClientDate(service.nextDueAt) : "No date"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Assigned to</dt>
                  <dd className="mt-1">
                    <AssignedEmployee name={service.assignedEmployeeName} />
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
          {tab === "tasks" ? (
            service.tasks.length ? (
              <ul className="flex flex-col divide-y rounded-[var(--radius-control)] border">
                {service.tasks.map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 text-muted-foreground">
                        {task.plannedDueAt ? `Due ${formatClientDate(task.plannedDueAt)}` : "No due date"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium">
                        {formatClientMoney(task.rateAmount, task.currencyCode || currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">{clientTaskListStatus(task.status)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks have been created yet.</p>
            )
          ) : null}
          {tab === "billing" ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>This month</span>
                <span className="font-medium">{formatClientMoney(schedule.thisMonthDue, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Next month</span>
                <span className="font-medium">{formatClientMoney(schedule.nextMonthDue, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Total task amount</span>
                <span className="font-medium">{formatClientMoney(schedule.taskTotal, currency)}</span>
              </div>
              {schedule.discountAmount > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span>Discount ({formatDiscountPercent(schedule.discountPercent)})</span>
                  <span>−{formatClientMoney(schedule.discountAmount, currency)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <span className="font-medium">Amount due</span>
                <span className="font-medium">{formatClientMoney(schedule.amountDue, currency)}</span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="outline" onClick={onMessage}>
              Message team
            </Button>
            <Link href="/client/task-calendar" className="text-sm font-medium text-primary hover:underline">
              View all tasks →
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServiceMessageDialog({
  service,
  open,
  onOpenChange,
}: {
  service: ClientPortalService | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const title = service
    ? `Message about ${clientServiceTitles(service.engagementName, service.serviceName).primary}`
    : "Message team";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description="Send a note to the team about this service.">
        {service ? (
          <ActiveServiceCommentForm
            serviceId={service.id}
            serviceName={clientServiceTitles(service.engagementName, service.serviceName).primary}
            onSent={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActiveServiceCommentForm({
  serviceId,
  serviceName,
  onSent,
  onCancel,
}: {
  serviceId: string;
  serviceName: string;
  onSent: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createClientServiceComment(serviceId, {
        idempotencyKey: crypto.randomUUID(),
        body: body.trim(),
      }),
    onSuccess: () => {
      setBody("");
      toast.success("Message sent to the team.");
      void queryClient.invalidateQueries({ queryKey: ["client-portal-dashboard"] });
      onSent();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Message could not be sent.");
    },
  });
  const canSend = body.trim().length >= 2 && !mutation.isPending;

  return (
    <form
      className="grid gap-3 pr-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSend) return;
        mutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">{`Message about ${serviceName}`}</h2>
      <label className="text-sm font-medium">
        Message
        <textarea
          className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={body}
          maxLength={2000}
          aria-label={`Comment on ${serviceName}`}
          placeholder="Write your message..."
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSend}>
          {mutation.isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </form>
  );
}

function CompactDateRangeControl({ period }: { period: ClientPortalPeriodControls }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = `${formatMonthYear(period.fromValue)} → ${formatMonthYear(period.toValue)}`;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!(target instanceof Element)) return;
      if (rootRef.current?.contains(target) || target.closest("[data-date-picker-popover]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="h-10 min-w-[12.5rem] justify-between gap-2 font-normal"
        aria-label="Service date range"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-control)] border bg-card p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presets</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => { period.onPresetChange("this_month"); setOpen(false); }}>
              This month
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => { period.onPresetChange("last_30_days"); setOpen(false); }}
            >
              Last 30 days
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => { period.onPresetChange("upcoming_year"); setOpen(false); }}
            >
              Next 12 months
            </Button>
          </div>
          <div className="mt-3 grid gap-2">
            <label className="text-sm font-medium">
              From
              <DatePicker className="mt-1" aria-label="Dashboard from date" value={period.fromValue} onChange={period.onFromChange} />
            </label>
            <label className="text-sm font-medium">
              To
              <DatePicker className="mt-1" aria-label="Dashboard to date" value={period.toValue} onChange={period.onToChange} />
            </label>
          </div>
          {period.invalidRange ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {period.incompleteRange
                ? "Choose both a start and end date."
                : period.invertedRange
                  ? "The end date must be on or after the start date."
                  : "The range cannot exceed 731 days."}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!period.filtersDirty || period.invalidRange || period.isFetching}
              onClick={() => {
                period.onApply();
                setOpen(false);
              }}
            >
              Apply dates
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PortfolioSummary({
  summary,
}: {
  summary: { serviceCount: number; taskCount: number; dueSoonCount: number; scheduledDisplay: string; scheduledExact: string };
}) {
  const items = [
    { label: "services", value: String(summary.serviceCount) },
    { label: "tasks", value: String(summary.taskCount) },
    { label: "due soon", value: String(summary.dueSoonCount) },
    { label: "scheduled", value: summary.scheduledDisplay, title: summary.scheduledExact },
  ];

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3">
      {items.map((item) => (
        <p key={item.label} className="text-sm" title={item.title}>
          <span className="font-semibold tabular-nums">{item.value}</span>
          <span className="ml-1.5 uppercase tracking-wide text-muted-foreground">{item.label}</span>
        </p>
      ))}
    </div>
  );
}

function ServiceProgress({
  completed,
  total,
  percent,
}: {
  completed: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          {completed} of {total}
        </span>
        <span className="tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-[var(--radius-control)] bg-muted">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function MoneyStat({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  const money = formatClientMoneyCompact(amount, currency);
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums" title={money.exact}>
        {money.display}
      </dd>
    </div>
  );
}

function ServiceLifecycleBadge({ status }: { status: string }) {
  const label = humanizeClientStatus(status);
  if (label === "Active") {
    return <Badge tone="success">Active</Badge>;
  }
  return <Badge>{label}</Badge>;
}

function AssignedEmployee({ name }: { name: string | null | undefined }) {
  if (!name) {
    return <span className="text-muted-foreground">Unassigned</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
        {employeeInitials(name)}
      </span>
      <span>{name}</span>
    </span>
  );
}

function uniqueStatuses(services: readonly ClientPortalService[]) {
  const byId = new Map<string, string>();
  for (const service of services) {
    if (!byId.has(service.status)) byId.set(service.status, humanizeClientStatus(service.status));
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
}

function uniqueAssignees(services: readonly ClientPortalService[]) {
  const byId = new Map<string, string>();
  for (const service of services) {
    const name = service.assignedEmployeeName?.trim();
    if (name && !byId.has(name)) byId.set(name, name);
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
}

function matchesServiceFilters(service: ClientPortalService, search: string, status: string, assignee: string) {
  if (status && service.status !== status) return false;
  if (assignee && service.assignedEmployeeName !== assignee) return false;
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const { primary, secondary } = clientServiceTitles(service.engagementName, service.serviceName);
  return [primary, secondary ?? "", service.assignedEmployeeName ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function summarizePortfolio(services: readonly ClientPortalService[], currencyCode: string) {
  const taskCount = services.reduce((sum, service) => sum + service.totalTasks, 0);
  const dueSoonCount = services.reduce(
    (sum, service) =>
      sum + service.tasks.filter((task) => isClientTaskDueSoon(task.plannedDueAt, task.status)).length,
    0,
  );
  const scheduled = services.reduce((sum, service) => {
    return sum + summarizeClientServiceSchedule(service.tasks, service.discountPercent).amountDue;
  }, 0);
  const money = formatClientMoneyCompact(scheduled, currencyCode);
  return {
    serviceCount: services.length,
    taskCount,
    dueSoonCount,
    scheduledDisplay: money.display,
    scheduledExact: money.exact,
  };
}

function formatBillingMonth(yearMonth: string) {
  return formatMonthLabel(yearMonth).slice(0, 3).toUpperCase();
}

function formatMonthYear(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return date ? format(date, "MMM yyyy") : isoDate;
}
