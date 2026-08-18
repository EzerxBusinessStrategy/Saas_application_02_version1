import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  calendarSummary,
  filterCalendarTasks,
  taskAccent,
  toCalendarTasks,
  visibleTasksPerCell,
  type CalendarTask,
} from "@/components/operations/task-calendar/task-calendar-utils";
import type { TenantAdminTask } from "@/features/operations/api/operations-api";

function sampleTask(overrides: Partial<TenantAdminTask> = {}): TenantAdminTask {
  return {
    id: "task-1",
    title: "GST Filing",
    description: null,
    clientId: "client-1",
    clientName: "Acme Operations",
    serviceId: "service-1",
    serviceName: "Taxation",
    workGroupId: null,
    workGroupName: null,
    priority: "normal",
    status: "assigned",
    slaStatus: "running",
    plannedDueAt: "2026-08-28T12:52:00.000Z",
    assigneeCount: 1,
    assignees: [{ id: "emp-1", name: "Rahul" }],
    latestSubmissionStatus: null,
    latestReviewRemarks: null,
    ...overrides,
  };
}

describe("task calendar utils", () => {
  it("maps and filters calendar tasks", () => {
    const tasks = toCalendarTasks([sampleTask(), sampleTask({ id: "task-2", plannedDueAt: null })]);
    expect(tasks).toHaveLength(1);

    const filtered = filterCalendarTasks(tasks, {
      search: "acme",
      employeeId: "",
      clientId: "",
      status: "all",
      priority: "all",
    });
    expect(filtered).toHaveLength(1);
  });

  it("filters by the task-board statuses used in the product", () => {
    const assigned = { ...sampleTask({ id: "assigned", status: "assigned" }), dueDate: parseISO("2026-08-28T12:52:00.000Z") };
    const inProgress = {
      ...sampleTask({ id: "progress", status: "in_progress" }),
      dueDate: parseISO("2026-08-28T12:52:00.000Z"),
    };
    const review = {
      ...sampleTask({ id: "review", status: "manager_review" }),
      dueDate: parseISO("2026-08-28T12:52:00.000Z"),
    };
    const returned = {
      ...sampleTask({ id: "returned", status: "returned" }),
      dueDate: parseISO("2026-08-28T12:52:00.000Z"),
    };
    const done = {
      ...sampleTask({ id: "done", status: "completed" }),
      dueDate: parseISO("2026-08-28T12:52:00.000Z"),
    };
    const tasks = [assigned, inProgress, review, returned, done];
    const filters = {
      search: "",
      employeeId: "",
      clientId: "",
      priority: "all" as const,
    };

    expect(filterCalendarTasks(tasks, { ...filters, status: "to-do" }).map((task) => task.id)).toEqual(["assigned"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "in-progress" }).map((task) => task.id)).toEqual(["progress"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "review" }).map((task) => task.id)).toEqual(["review"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "rejected" }).map((task) => task.id)).toEqual(["returned"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "done" }).map((task) => task.id)).toEqual(["done"]);
  });

  it("shows one task per day in the compact dashboard calendar", () => {
    expect(visibleTasksPerCell(true)).toBe(1);
    expect(visibleTasksPerCell(false)).toBe(3);
  });

  it("derives overdue accent and summary counts", () => {
    const overdueTask = {
      ...sampleTask({ status: "assigned" }),
      dueDate: parseISO("2020-01-01T09:00:00.000Z"),
    } satisfies CalendarTask;

    expect(taskAccent(overdueTask)).toBe("danger");
    expect(calendarSummary([overdueTask]).overdue).toBe(1);
  });
});
