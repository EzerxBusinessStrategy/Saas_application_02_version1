import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import type { ClientPortalCalendarTask } from "@/features/client-portal/api/client-portal-task-calendar-api";
import type { TenantAdminTask } from "@/features/operations/api/operations-api";
import {
  isTenantAdminTaskAwaitingReview,
  mapTenantAdminTaskFeatureStatus,
  tenantTaskReviewHref,
} from "@/features/operations/tenant-admin-task-map";
import type { OperationalTask } from "@/types/operations";

export type CalendarView = "month" | "week" | "agenda";
export type CalendarAudience = "tenant" | "client";

const tenantTaskStatuses: ReadonlySet<TenantAdminTask["status"]> = new Set([
  "draft",
  "requested",
  "open",
  "assigned",
  "in_progress",
  "submitted",
  "manager_review",
  "returned",
  "tenant_approval",
  "approved",
  "completed",
  "cancelled",
]);

export type CalendarTask = TenantAdminTask & {
  dueDate: Date;
  frequency: string | null;
};

export type ClientCalendarBucket = "all" | "scheduled" | "in_progress" | "completed" | "overdue";
export type CalendarDueWindow =
  | "all"
  | "due_soon"
  | "overdue"
  | "this_month"
  | "due_today"
  | "next_7"
  | "next_30"
  | "no_due";

export type CalendarFilters = {
  search: string;
  employeeId: string;
  clientId: string;
  status: string;
  priority: string;
  serviceName: string;
  clientBucket: ClientCalendarBucket;
  dueWindow: CalendarDueWindow;
  frequency: string;
};

export function defaultCalendarFilters(): CalendarFilters {
  return {
    search: "",
    employeeId: "",
    clientId: "",
    status: "all",
    priority: "all",
    serviceName: "",
    clientBucket: "all",
    dueWindow: "all",
    frequency: "all",
  };
}

export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const visibleTasksPerDay = 3;

export function visibleTasksPerCell(compact: boolean): number {
  return compact ? 1 : visibleTasksPerDay;
}

export const taskStatusOptions: ReadonlyArray<{
  value: OperationalTask["status"];
  label: string;
}> = [
  { value: "to-do", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "rejected", label: "Returned" },
  { value: "done", label: "Done" },
];

export function calendarDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });
}

export function weekDays(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function toCalendarTasks(tasks: readonly TenantAdminTask[]): CalendarTask[] {
  return tasks.flatMap((task) => {
    if (!task.plannedDueAt) return [];
    const dueDate = parseISO(task.plannedDueAt);
    return Number.isNaN(dueDate.getTime()) ? [] : [{ ...task, dueDate, frequency: null }];
  });
}

export function toClientCalendarTasks(tasks: readonly ClientPortalCalendarTask[]): CalendarTask[] {
  return tasks.flatMap((task) => {
    const dueDate = parseISO(task.plannedDueAt);
    if (Number.isNaN(dueDate.getTime())) return [];
    return [
      {
        id: task.id,
        title: task.title,
        description: null,
        clientId: "",
        clientName: task.serviceName,
        serviceId: task.serviceId || "",
        serviceName: task.serviceName,
        workGroupId: null,
        workGroupName: null,
        priority: asTenantPriority(task.priority),
        status: asTenantTaskStatus(task.status),
        slaStatus: "running",
        plannedDueAt: task.plannedDueAt,
        assigneeCount: task.assignees.length,
        assignees: task.assignees,
        latestSubmissionStatus: null,
        latestReviewRemarks: null,
        dueDate,
        frequency: task.frequency,
      },
    ];
  });
}

export function calendarQueryRange(view: CalendarView, focusDate: Date) {
  const days = view === "week" ? weekDays(focusDate) : calendarDays(focusDate);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) {
    return { from: format(focusDate, "yyyy-MM-dd"), to: format(focusDate, "yyyy-MM-dd") };
  }
  return {
    from: format(first, "yyyy-MM-dd"),
    to: format(last, "yyyy-MM-dd"),
  };
}

function asTenantPriority(value: string): TenantAdminTask["priority"] {
  switch (value) {
    case "low":
    case "normal":
    case "high":
    case "urgent":
      return value;
    default:
      return "normal";
  }
}

export function clientTaskBucket(task: CalendarTask): Exclude<ClientCalendarBucket, "all" | "overdue"> {
  if (["completed", "approved"].includes(task.status)) return "completed";
  if (["in_progress", "submitted", "manager_review", "tenant_approval", "returned"].includes(task.status)) {
    return "in_progress";
  }
  return "scheduled";
}

export function clientTaskStatusLabel(task: CalendarTask): string {
  const bucket = clientTaskBucket(task);
  switch (bucket) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "scheduled":
      return "Scheduled";
    default: {
      const exhaustive: never = bucket;
      return exhaustive;
    }
  }
}

export function clientCalendarSummary(tasks: readonly CalendarTask[]) {
  return {
    scheduled: tasks.filter((task) => clientTaskBucket(task) === "scheduled").length,
    inProgress: tasks.filter((task) => clientTaskBucket(task) === "in_progress").length,
    completed: tasks.filter((task) => clientTaskBucket(task) === "completed").length,
  };
}

export function matchesDueWindow(task: CalendarTask, window: CalendarDueWindow, now: Date = new Date()): boolean {
  switch (window) {
    case "all":
      return true;
    case "due_soon":
      return isTaskDueSoon(task);
    case "overdue":
      return isTaskOverdue(task);
    case "this_month":
      return isSameMonth(task.dueDate, now);
    case "due_today":
      return isSameDay(task.dueDate, now);
    case "next_7":
      return isWithinUpcomingDays(task, 7, now);
    case "next_30":
      return isWithinUpcomingDays(task, 30, now);
    case "no_due":
      return !task.plannedDueAt;
    default: {
      const exhaustive: never = window;
      return exhaustive;
    }
  }
}

function isWithinUpcomingDays(task: CalendarTask, days: number, now: Date): boolean {
  if (isTaskOverdue(task)) return false;
  const diff = Math.round((startOfDay(task.dueDate).getTime() - startOfDay(now).getTime()) / 86_400_000);
  return diff >= 0 && diff <= days;
}

export function normalizeTaskFrequency(value: string | null | undefined): string {
  const key = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "annual" || key === "yearly") return "annually";
  if (key === "onetime") return "one_time";
  return key;
}

function asTenantTaskStatus(status: string): TenantAdminTask["status"] {
  return tenantTaskStatuses.has(status as TenantAdminTask["status"])
    ? (status as TenantAdminTask["status"])
    : "open";
}

export function filterCalendarTasks(
  tasks: readonly CalendarTask[],
  filters: CalendarFilters,
): CalendarTask[] {
  const needle = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.employeeId && !task.assignees.some((assignee) => assignee.id === filters.employeeId)) {
      return false;
    }
    if (filters.clientId && task.clientId !== filters.clientId) return false;
    if (filters.serviceName && task.serviceName !== filters.serviceName) return false;
    if (filters.frequency !== "all") {
      if (normalizeTaskFrequency(task.frequency) !== filters.frequency) return false;
    }
    if (filters.clientBucket === "overdue") {
      if (!isTaskOverdue(task)) return false;
    } else if (filters.clientBucket !== "all" && clientTaskBucket(task) !== filters.clientBucket) {
      return false;
    }
    if (!matchesDueWindow(task, filters.dueWindow)) return false;
    if (filters.status !== "all" && mapTenantAdminTaskFeatureStatus(task) !== filters.status) {
      return false;
    }
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (!needle) return true;

    const haystack = [
      task.title,
      task.description ?? "",
      task.clientName,
      task.serviceName,
      task.workGroupName ?? "",
      ...task.assignees.map((assignee) => assignee.name),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

export function tasksForDay(tasks: readonly CalendarTask[], day: Date) {
  return tasks.filter((task) => isSameDay(task.dueDate, day));
}

export function tasksForMonth(tasks: readonly CalendarTask[], month: Date) {
  return tasks.filter((task) => isSameMonth(task.dueDate, month));
}

export function tasksForWeek(tasks: readonly CalendarTask[], anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  const end = endOfWeek(anchor, { weekStartsOn: 0 });
  return tasks.filter((task) => isWithinInterval(task.dueDate, { start, end }));
}

export function calendarSummary(tasks: readonly CalendarTask[]) {
  const openStatuses = new Set([
    "draft",
    "requested",
    "open",
    "assigned",
    "in_progress",
    "submitted",
    "manager_review",
    "tenant_approval",
    "returned",
  ]);

  return {
    open: tasks.filter((task) => openStatuses.has(task.status)).length,
    completed: tasks.filter((task) => ["completed", "approved"].includes(task.status)).length,
    overdue: tasks.filter((task) => isTaskOverdue(task)).length,
  };
}

export function isTaskOverdue(task: CalendarTask): boolean {
  if (["completed", "approved", "cancelled"].includes(task.status)) return false;
  return isBefore(task.dueDate, new Date());
}

export function isTaskDueSoon(task: CalendarTask): boolean {
  if (["completed", "approved", "cancelled"].includes(task.status)) return false;
  const now = startOfDay(new Date());
  const due = startOfDay(task.dueDate);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= 2;
}

export type TaskAccent = "info" | "success" | "warning" | "danger" | "neutral";

export function taskAccent(task: CalendarTask): TaskAccent {
  if (["completed", "approved"].includes(task.status)) return "success";
  if (["cancelled", "draft"].includes(task.status)) return "neutral";
  if (isTaskOverdue(task)) return "danger";
  if (isTaskDueSoon(task) || ["manager_review", "tenant_approval", "returned"].includes(task.status)) {
    return "warning";
  }
  return "info";
}

export function taskAccentClass(accent: TaskAccent): string {
  switch (accent) {
    case "success":
      return "border-l-emerald-500";
    case "warning":
      return "border-l-amber-500";
    case "danger":
      return "border-l-red-500";
    case "neutral":
      return "border-l-muted-foreground/40";
    case "info":
    default:
      return "border-l-sky-500";
  }
}

export function assigneeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function primaryAssigneeLabel(task: TenantAdminTask): string {
  if (!task.assignees.length) return "Unassigned";
  return task.assignees[0]!.name;
}

export function assigneeSummary(task: TenantAdminTask): string {
  if (!task.assignees.length) return "Unassigned";
  const visible = task.assignees.slice(0, 2).map((assignee) => assignee.name).join(", ");
  return task.assignees.length > 2 ? `${visible} +${task.assignees.length - 2}` : visible;
}

export function humanise(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function taskOpenHref(task: CalendarTask): string {
  return isTenantAdminTaskAwaitingReview(task)
    ? tenantTaskReviewHref(task.id)
    : `/admin/tasks?task=${encodeURIComponent(task.id)}`;
}

export function navigateCalendar(view: CalendarView, focusDate: Date, direction: "prev" | "next"): Date {
  if (view === "week") {
    return direction === "prev" ? subWeeks(focusDate, 1) : addWeeks(focusDate, 1);
  }
  return direction === "prev" ? subMonths(focusDate, 1) : addMonths(focusDate, 1);
}

export function calendarHeading(view: CalendarView, focusDate: Date): string {
  if (view === "week") {
    const start = startOfWeek(focusDate, { weekStartsOn: 0 });
    const end = endOfWeek(focusDate, { weekStartsOn: 0 });
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "d")} – ${format(end, "d MMMM yyyy")}`;
    }
    return `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
  }
  return format(focusDate, "MMMM yyyy");
}

export function formatTaskDueTime(value: Date): string {
  return format(value, "h:mm a");
}

export function formatTaskDueDate(value: Date): string {
  return format(value, "d MMM yyyy");
}

export function formatAgendaHeading(day: Date): string {
  if (isSameDay(day, new Date())) return `Today · ${format(day, "d MMM").toUpperCase()}`;
  return `${format(day, "EEEE").toUpperCase()} · ${format(day, "d MMM").toUpperCase()}`;
}
