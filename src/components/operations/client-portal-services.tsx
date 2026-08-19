"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ListChecks } from "lucide-react";
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
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ClientPortalDashboard } from "@/features/client-portal/api/client-portal-dashboard-api";
import { createClientServiceComment } from "@/features/client-portal/api/client-portal-service-comments-api";
import {
  formatDiscountPercent,
  formatMonthLabel,
  summarizeClientServiceSchedule,
  taskYearMonth,
} from "@/features/client-portal/client-service-pricing";
import {
  clientServiceTitles,
  employeeInitials,
  formatClientDate,
  formatClientMoney,
  humanizeClientStatus,
  nextOpenClientTask,
} from "@/components/operations/client-portal-display";
import { cn } from "@/lib/utils";

type ClientPortalService = ClientPortalDashboard["services"][number];
type ClientPortalTask = ClientPortalService["tasks"][number];

const COMPACT_SERVICE_LIMIT = 3;

export function ClientServices({
  services,
  compact = false,
}: {
  services: ClientPortalDashboard["services"];
  compact?: boolean;
}) {
  const [drawerServiceId, setDrawerServiceId] = useState<string | null>(null);
  const [messageServiceId, setMessageServiceId] = useState<string | null>(null);
  const visible = compact ? services.slice(0, COMPACT_SERVICE_LIMIT) : services;
  const drawerService = services.find((service) => service.id === drawerServiceId) ?? null;
  const messageService = services.find((service) => service.id === messageServiceId) ?? null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-[18px] text-primary" />
                {compact ? "Your services" : "Active services"}
              </CardTitle>
              <CardDescription>
                {compact
                  ? `${services.length} active`
                  : "Progress, billing, and the next due date for each purchased service."}
              </CardDescription>
            </div>
            {compact && services.length ? (
              <Link href="/client/services" className="shrink-0 text-sm font-medium text-primary">
                View all
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {visible.length ? (
            <ul className={compact ? "grid gap-4" : "flex flex-col divide-y"}>
              {visible.map((service) =>
                compact ? (
                  <li key={service.id}>
                    <CompactServiceCard
                      service={service}
                      onOpen={() => setDrawerServiceId(service.id)}
                    />
                  </li>
                ) : (
                  <FullServiceCard
                    key={service.id}
                    service={service}
                    onOpen={() => setDrawerServiceId(service.id)}
                    onMessage={() => setMessageServiceId(service.id)}
                  />
                ),
              )}
            </ul>
          ) : (
            <EmptyState
              title="No active services"
              description="Tick services from Requests. After the tenant accepts, they appear here with dates and prices."
            />
          )}
        </CardContent>
      </Card>
      <ClientServiceDrawer
        service={drawerService}
        open={Boolean(drawerService)}
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

function CompactServiceCard({
  service,
  onOpen,
}: {
  service: ClientPortalService;
  onOpen: () => void;
}) {
  const currency = service.currencyCode ?? "INR";
  const schedule = summarizeClientServiceSchedule(service.tasks, service.discountPercent);
  const { primary, secondary } = clientServiceTitles(service.engagementName, service.serviceName);
  const nextTask = nextOpenClientTask(service.tasks, service.nextDueAt);

  return (
    <article className="rounded-[var(--radius-control)] border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{primary}</p>
          {secondary ? <p className="mt-1 text-sm text-muted-foreground">{secondary}</p> : null}
        </div>
        <ServiceLifecycleBadge status={service.status} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {service.completedTasks} of {service.totalTasks} tasks completed
      </p>
      <ServiceProgress percent={service.progressPercent} />
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Next due</dt>
          <dd className="mt-1 font-medium">{nextTask?.title ?? "None"}</dd>
          <dd className="mt-0.5 text-muted-foreground">
            {service.nextDueAt ? formatClientDate(service.nextDueAt) : "No date"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">This month</dt>
          <dd className="mt-1 font-medium">{formatClientMoney(schedule.thisMonthDue, currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="mt-1 font-medium">{formatClientMoney(schedule.amountDue, currency)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3">
        <AssignedEmployee name={service.assignedEmployeeName} />
        <Button size="sm" variant="ghost" onClick={onOpen}>
          View service →
        </Button>
      </div>
    </article>
  );
}

function FullServiceCard({
  service,
  onOpen,
  onMessage,
}: {
  service: ClientPortalService;
  onOpen: () => void;
  onMessage: () => void;
}) {
  const currency = service.currencyCode ?? "INR";
  const schedule = summarizeClientServiceSchedule(service.tasks, service.discountPercent);
  const { primary, secondary } = clientServiceTitles(service.engagementName, service.serviceName);

  return (
    <li className="py-4 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{primary}</p>
          {secondary ? <p className="mt-1 text-sm text-muted-foreground">{secondary}</p> : null}
        </div>
        <ServiceLifecycleBadge status={service.status} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {service.completedTasks}/{service.totalTasks} tasks completed
        {service.openTasks > 0 ? ` · ${service.openTasks} open` : ""}
      </p>
      <ServiceProgress percent={service.progressPercent} />
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="text-sm">
          <dt className="text-muted-foreground">This month ({formatMonthLabel(schedule.thisMonthKey)})</dt>
          <dd className="mt-1 font-medium">{formatClientMoney(schedule.thisMonthDue, currency)}</dd>
        </div>
        <div className="text-sm">
          <dt className="text-muted-foreground">Next month ({formatMonthLabel(schedule.nextMonthKey)})</dt>
          <dd className="mt-1 font-medium">{formatClientMoney(schedule.nextMonthDue, currency)}</dd>
        </div>
        <div className="text-sm">
          <dt className="text-muted-foreground">Scheduled total</dt>
          <dd className="mt-1 font-medium">{formatClientMoney(schedule.amountDue, currency)}</dd>
        </div>
      </dl>
      {service.assignedEmployeeName ? (
        <div className="mt-3">
          <AssignedEmployee name={service.assignedEmployeeName} />
        </div>
      ) : null}
      {service.tasks.length ? (
        <ClientServiceTaskDropdown
          serviceName={primary}
          tasks={service.tasks}
          schedule={schedule}
          currency={currency}
        />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No tasks have been created for this service yet.</p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onMessage}>
          Message tenant
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpen}>
          View service →
        </Button>
      </div>
    </li>
  );
}

function ClientServiceDrawer({
  service,
  open,
  onOpenChange,
  onMessage,
}: {
  service: ClientPortalService | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessage: () => void;
}) {
  if (!service) return null;

  const currency = service.currencyCode ?? "INR";
  const schedule = summarizeClientServiceSchedule(service.tasks, service.discountPercent);
  const { primary, secondary } = clientServiceTitles(service.engagementName, service.serviceName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Service details"
        description={primary}
        className="left-auto right-0 top-0 h-full max-h-none w-full max-w-xl translate-x-0 translate-y-0 overflow-y-auto rounded-none"
      >
        <div className="pr-8">
          <h2 className="text-lg font-semibold">Service details</h2>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{primary}</p>
              {secondary ? <p className="mt-1 text-sm text-muted-foreground">{secondary}</p> : null}
            </div>
            <ServiceLifecycleBadge status={service.status} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {service.completedTasks} / {service.totalTasks} completed
          </p>
          <ServiceProgress percent={service.progressPercent} />
          <AssignedEmployee name={service.assignedEmployeeName} className="mt-4" />
          <h3 className="mt-6 text-sm font-medium">Tasks</h3>
          {service.tasks.length ? (
            <ul className="mt-2 flex flex-col divide-y rounded-[var(--radius-control)] border">
              {service.tasks.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-muted-foreground">
                      {humanizeClientStatus(task.status)}
                      {task.plannedDueAt ? ` · ${formatClientDate(task.plannedDueAt)}` : ""}
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatClientMoney(task.rateAmount, task.currencyCode || currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No tasks have been created yet.</p>
          )}
          <h3 className="mt-6 text-sm font-medium">Billing summary</h3>
          <p className="mt-2 text-sm">{formatClientMoney(schedule.amountDue, currency)} scheduled</p>
          {schedule.discountAmount > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Includes {formatDiscountPercent(schedule.discountPercent)} discount
            </p>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Button onClick={onMessage}>Message tenant</Button>
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
    : "Message tenant";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description="Send a note to the tenant about this service.">
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
      toast.success("Comment sent to the tenant.");
      void queryClient.invalidateQueries({ queryKey: ["client-portal-dashboard"] });
      onSent();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Comment could not be sent.");
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

function ClientServiceTaskDropdown({
  serviceName,
  tasks,
  schedule,
  currency,
}: {
  serviceName: string;
  tasks: ClientPortalTask[];
  schedule: ReturnType<typeof summarizeClientServiceSchedule>;
  currency: string;
}) {
  const taskCountLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  return (
    <details className="group mt-3 rounded-[var(--radius-control)] border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="font-medium">
          {taskCountLabel} under {serviceName}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">{formatClientMoney(schedule.amountDue, currency)}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <ul className="flex flex-col divide-y border-t">
        {tasks.map((task) => {
          const yearMonth = taskYearMonth(task.plannedDueAt);
          const monthHint =
            yearMonth === schedule.thisMonthKey
              ? "This month"
              : yearMonth === schedule.nextMonthKey
                ? "Next month"
                : null;
          return (
            <li key={task.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="mt-1 text-muted-foreground">
                  {task.plannedDueAt ? formatClientDate(task.plannedDueAt) : "No due date"}
                  {monthHint ? ` · ${monthHint}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium">
                  {formatClientMoney(task.rateAmount, task.currencyCode || currency)}
                </span>
                <StatusBadge status={mapTaskStatus(task.status)} />
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="font-medium">Total task amount</span>
          <span className="font-medium">{formatClientMoney(schedule.taskTotal, currency)}</span>
        </li>
        {schedule.discountAmount > 0 ? (
          <>
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>Discount ({formatDiscountPercent(schedule.discountPercent)})</span>
              <span>−{formatClientMoney(schedule.discountAmount, currency)}</span>
            </li>
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-medium">Amount due</span>
              <span className="font-medium">{formatClientMoney(schedule.amountDue, currency)}</span>
            </li>
          </>
        ) : null}
      </ul>
    </details>
  );
}

function ServiceProgress({ percent }: { percent: number }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between gap-3 text-sm">
        <span className="sr-only">Progress</span>
        <span className="ml-auto text-muted-foreground">{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-control)] bg-muted">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
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

function AssignedEmployee({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  if (!name) return null;
  return (
    <p className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {employeeInitials(name)}
      </span>
      <span>{name}</span>
    </p>
  );
}

function mapTaskStatus(status: string) {
  switch (status) {
    case "completed":
      return "complete";
    case "cancelled":
      return "pending";
    case "in_progress":
    case "submitted":
    case "manager_review":
    case "tenant_approval":
    case "approved":
      return "on-track";
    default:
      return "pending";
  }
}
