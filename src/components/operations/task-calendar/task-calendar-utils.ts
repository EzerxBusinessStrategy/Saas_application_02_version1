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
import type { TenantAdminTask } from "@/features/operations/api/operations-api";
import {
  isTenantAdminTaskAwaitingReview,
  tenantTaskReviewHref,
} from "@/features/operations/tenant-admin-task-map";

export type CalendarView = "month" | "week" | "agenda";

export type CalendarTask = TenantAdminTask & { dueDate: Date };

export type CalendarFilters = {
  search: string;
  employeeId: string;
  clientId: string;
  status: string;
  priority: string;
};

export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const visibleTasksPerDay = 3;

export const taskStatusOptions = [
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
] as const;

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
    return Number.isNaN(dueDate.getTime()) ? [] : [{ ...task, dueDate }];
  });
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
    if (filters.status !== "all" && task.status !== filters.status) return false;
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
