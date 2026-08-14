"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { listTenantAdminTasks, type TenantAdminTask } from "@/features/operations/api/operations-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const visibleTasksPerDay = 3;

type CalendarTask = TenantAdminTask & { dueDate: Date };

export function TenantTaskCalendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const tasksQuery = useQuery({
    queryKey: ["tenant-task-calendar"],
    queryFn: () => listTenantAdminTasks(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const calendarTasks = useMemo(
    () =>
      (tasksQuery.data ?? []).flatMap((task) => {
        if (!task.plannedDueAt) return [];
        const dueDate = parseISO(task.plannedDueAt);
        return Number.isNaN(dueDate.getTime()) ? [] : [{ ...task, dueDate }];
      }),
    [tasksQuery.data],
  );
  const days = useMemo(() => calendarDays(month), [month]);
  const visibleMonthTasks = useMemo(
    () => calendarTasks.filter((task) => isSameMonth(task.dueDate, month)),
    [calendarTasks, month],
  );
  const summary = useMemo(
    () => ({
      scheduled: visibleMonthTasks.length,
      inProgress: visibleMonthTasks.filter((task) => task.status === "in_progress").length,
      completed: visibleMonthTasks.filter((task) => ["completed", "approved"].includes(task.status)).length,
    }),
    [visibleMonthTasks],
  );

  if (tasksQuery.isPending) return <LoadingState label="Loading task calendar" rows={6} />;
  if (tasksQuery.isError) {
    return (
      <ErrorState
        title="Task calendar could not load"
        description="The current tenant tasks could not be retrieved."
        onRetry={() => void tasksQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Task calendar"
        description="Monitor scheduled tenant work, assignees, clients, and live workflow status."
        actions={
          <Button variant="outline" size="sm" onClick={() => void tasksQuery.refetch()} disabled={tasksQuery.isFetching}>
            <RefreshCw className={cn("size-4", tasksQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <CalendarSummary label="Scheduled" value={summary.scheduled} tone="info" />
        <CalendarSummary label="In progress" value={summary.inProgress} tone="warning" />
        <CalendarSummary label="Completed" value={summary.completed} tone="success" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <CalendarDays className="size-5 shrink-0 text-primary" />
              <h2 className="truncate text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" className="w-8 px-0" aria-label="Previous month" onClick={() => setMonth((current) => subMonths(current, 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
              <Button variant="ghost" size="sm" className="w-8 px-0" aria-label="Next month" onClick={() => setMonth((current) => addMonths(current, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {weekdayLabels.map((weekday) => <p key={weekday} className="px-3 py-2 text-xs font-medium text-muted-foreground">{weekday}</p>)}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const tasks = calendarTasks.filter((task) => isSameDay(task.dueDate, day));
                  return <CalendarDay key={day.toISOString()} day={day} month={month} tasks={tasks} />;
                })}
              </div>
            </div>
          </div>

          <div className="divide-y md:hidden">
            {visibleMonthTasks.length ? visibleMonthTasks
              .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
              .map((task) => <MobileCalendarTask key={task.id} task={task} />) : (
              <div className="p-6"><EmptyState title="No scheduled tasks" description="Tasks with due dates in this month will appear here." /></div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarDay({ day, month, tasks }: { day: Date; month: Date; tasks: CalendarTask[] }) {
  const currentMonth = isSameMonth(day, month);
  const today = isSameDay(day, new Date());
  const visible = tasks.slice(0, visibleTasksPerDay);
  return (
    <div className={cn("min-h-40 border-b border-r p-2", !currentMonth && "bg-muted/20 text-muted-foreground")}>
      <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", today && "bg-primary text-primary-foreground")}>{format(day, "d")}</span>
      <div className="mt-2 space-y-1.5">
        {visible.map((task) => <CalendarTaskItem key={task.id} task={task} />)}
        {tasks.length > visible.length ? <p className="px-1 text-xs text-muted-foreground">+{tasks.length - visible.length} more</p> : null}
      </div>
    </div>
  );
}

function CalendarTaskItem({ task }: { task: CalendarTask }) {
  return (
    <Link href={`/admin/tasks?task=${encodeURIComponent(task.id)}`} className="block rounded-md border bg-background px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <p className="truncate text-xs font-medium text-foreground">{task.title}</p>
      <p className="truncate text-[11px] text-muted-foreground">{task.clientName}</p>
      <p className="truncate text-[11px] text-muted-foreground">{assigneeLabel(task)}</p>
      <Badge tone={taskStatusTone(task.status)} className="mt-1 max-w-full truncate px-1.5 text-[10px]">{taskStatusLabel(task.status)}</Badge>
    </Link>
  );
}

function MobileCalendarTask({ task }: { task: CalendarTask }) {
  return (
    <Link href={`/admin/tasks?task=${encodeURIComponent(task.id)}`} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/50">
      <time className="flex w-11 shrink-0 flex-col text-center"><span className="text-xs text-muted-foreground">{format(task.dueDate, "EEE")}</span><span className="text-xl font-semibold leading-6">{format(task.dueDate, "d")}</span></time>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.clientName} · {assigneeLabel(task)}</p></div>
      <Badge tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Badge>
    </Link>
  );
}

function CalendarSummary({ label, value, tone }: { label: string; value: number; tone: "info" | "warning" | "success" }) {
  return <Card><CardContent className="flex items-center justify-between gap-3 py-4"><p className="text-sm text-muted-foreground">{label}</p><Badge tone={tone} className="min-w-8">{value}</Badge></CardContent></Card>;
}

function calendarDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });
}

function assigneeLabel(task: TenantAdminTask) {
  if (!task.assignees.length) return "Unassigned";
  const visible = task.assignees.slice(0, 2).map((assignee) => assignee.name).join(", ");
  return task.assignees.length > 2 ? `${visible} +${task.assignees.length - 2}` : visible;
}

function taskStatusLabel(status: TenantAdminTask["status"]) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function taskStatusTone(status: TenantAdminTask["status"]): "neutral" | "info" | "warning" | "success" | "danger" {
  if (["completed", "approved"].includes(status)) return "success";
  if (["cancelled", "returned"].includes(status)) return "danger";
  if (["in_progress", "manager_review", "tenant_approval"].includes(status)) return "warning";
  if (["assigned", "open", "requested"].includes(status)) return "info";
  return "neutral";
}
