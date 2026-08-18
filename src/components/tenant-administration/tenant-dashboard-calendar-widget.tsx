"use client";

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
import { CalendarDays, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { listTenantAdminTasks, type TenantAdminTask } from "@/features/operations/api/operations-api";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const visibleTasksPerDay = 2;

type CalendarTask = TenantAdminTask & { dueDate: Date };

type TenantDashboardCalendarWidgetProps = {
  clientId?: string;
  employeeId?: string;
};

export function TenantDashboardCalendarWidget({ clientId, employeeId }: TenantDashboardCalendarWidgetProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");

  const tasksQuery = useQuery({
    queryKey: ["tenant-dashboard-calendar", clientId ?? "", employeeId ?? ""],
    queryFn: () => listTenantAdminTasks(clientId),
    staleTime: 15_000,
  });

  const calendarTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (tasksQuery.data ?? []).flatMap((task) => {
      if (!task.plannedDueAt) return [];
      const dueDate = parseISO(task.plannedDueAt);
      if (Number.isNaN(dueDate.getTime())) return [];
      if (employeeId && !task.assignees.some((assignee) => assignee.id === employeeId)) return [];
      if (priority !== "all" && task.priority !== priority) return [];
      if (needle) {
        const haystack = [task.title, task.description ?? "", task.clientName, ...task.assignees.map((a) => a.name)]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return [];
      }
      return [{ ...task, dueDate }];
    });
  }, [employeeId, priority, search, tasksQuery.data]);

  const days = useMemo(() => calendarDays(month), [month]);
  const selectedTask = calendarTasks.find((task) => task.id === selectedTaskId) ?? null;

  return (
    <Card>
      <CardHeader className="gap-4 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-[18px] text-primary" aria-hidden="true" />
              Task calendar
            </CardTitle>
            <CardDescription>Click a task to review client, employee, and workflow details.</CardDescription>
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
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
          <label className="text-sm font-medium">
            Search
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-9" placeholder="Search title, client, or employee" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search calendar tasks" />
            </div>
          </label>
          <label className="text-sm font-medium">
            Priority
            <Select className="mt-1" value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter calendar by priority">
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </label>
          <div className="flex items-end">
            <p className="text-sm text-muted-foreground">{format(month, "MMMM yyyy")} · {calendarTasks.filter((task) => isSameMonth(task.dueDate, month)).length} tasks</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="overflow-x-auto border-b xl:border-b-0 xl:border-r">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {weekdayLabels.map((weekday) => (
                  <p key={weekday} className="px-2 py-2 text-xs font-medium text-muted-foreground">{weekday}</p>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const tasks = calendarTasks.filter((task) => isSameDay(task.dueDate, day));
                  return (
                    <CalendarDay
                      key={day.toISOString()}
                      day={day}
                      month={month}
                      tasks={tasks}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={setSelectedTaskId}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <aside className="min-h-[18rem] p-4">
            {selectedTask ? (
              <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />
            ) : (
              <EmptyState
                title="Select a task"
                description="Choose a calendar task to inspect client, employee assignment, and status details."
              />
            )}
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarDay({
  day,
  month,
  tasks,
  selectedTaskId,
  onSelectTask,
}: {
  day: Date;
  month: Date;
  tasks: CalendarTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}) {
  const currentMonth = isSameMonth(day, month);
  const today = isSameDay(day, new Date());
  const visible = tasks.slice(0, visibleTasksPerDay);

  return (
    <div className={cn("min-h-28 border-b border-r p-1.5", !currentMonth && "bg-muted/20 text-muted-foreground")}>
      <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", today && "bg-primary text-primary-foreground")}>
        {format(day, "d")}
      </span>
      <div className="mt-1 space-y-1">
        {visible.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelectTask(task.id)}
            className={cn(
              "block w-full rounded-md border px-1.5 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedTaskId === task.id && "border-primary bg-primary/5",
            )}
          >
            <p className="truncate text-[11px] font-medium">{task.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">{task.clientName}</p>
          </button>
        ))}
        {tasks.length > visible.length ? (
          <p className="px-1 text-[10px] text-muted-foreground">+{tasks.length - visible.length} more</p>
        ) : null}
      </div>
    </div>
  );
}

function TaskDetailPanel({ task, onClose }: { task: CalendarTask; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Task details</p>
          <h3 className="mt-1 text-base font-semibold">{task.title}</h3>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <dl className="space-y-3 text-sm">
        <DetailRow label="Client" value={task.clientName} />
        <DetailRow label="Service" value={task.serviceName} />
        <DetailRow label="Due" value={format(task.dueDate, "PPP p")} />
        <DetailRow label="Priority" value={humanise(task.priority)} />
        <DetailRow label="Status" value={humanise(task.status)} />
        <DetailRow label="Work group" value={task.workGroupName ?? "Direct assignment"} />
      </dl>
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          Assigned employees
        </p>
        {task.assignees.length ? (
          <ul className="space-y-2">
            {task.assignees.map((assignee) => (
              <li key={assignee.id} className="rounded-md border px-3 py-2 text-sm">{assignee.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active assignees.</p>
        )}
      </div>
      <Badge tone={taskStatusTone(task.status)}>{humanise(task.status)}</Badge>
      {task.description ? <p className="text-sm text-muted-foreground">{task.description}</p> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function calendarDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });
}

function humanise(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function taskStatusTone(status: TenantAdminTask["status"]): "neutral" | "info" | "warning" | "success" | "danger" {
  if (["completed", "approved"].includes(status)) return "success";
  if (["cancelled", "returned"].includes(status)) return "danger";
  if (["in_progress", "manager_review", "tenant_approval"].includes(status)) return "warning";
  if (["assigned", "open", "requested"].includes(status)) return "info";
  return "neutral";
}
