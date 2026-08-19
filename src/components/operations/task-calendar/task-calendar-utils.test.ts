import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  calendarSummary,
  clientCalendarSummary,
  defaultCalendarFilters,
  filterCalendarTasks,
  taskAccent,
  toCalendarTasks,
  toClientCalendarTasks,
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

function withDue(task: TenantAdminTask, dueAt = "2026-08-28T12:52:00.000Z"): CalendarTask {
  return { ...task, dueDate: parseISO(dueAt), frequency: null };
}

describe("task calendar utils", () => {
  it("maps and filters calendar tasks", () => {
    const tasks = toCalendarTasks([sampleTask(), sampleTask({ id: "task-2", plannedDueAt: null })]);
    expect(tasks).toHaveLength(1);

    const filtered = filterCalendarTasks(tasks, {
      ...defaultCalendarFilters(),
      search: "acme",
    });
    expect(filtered).toHaveLength(1);
  });

  it("filters by the task-board statuses used in the product", () => {
    const tasks = [
      withDue(sampleTask({ id: "assigned", status: "assigned" })),
      withDue(sampleTask({ id: "progress", status: "in_progress" })),
      withDue(sampleTask({ id: "review", status: "manager_review" })),
      withDue(sampleTask({ id: "returned", status: "returned" })),
      withDue(sampleTask({ id: "done", status: "completed" })),
    ];
    const filters = defaultCalendarFilters();

    expect(filterCalendarTasks(tasks, { ...filters, status: "to-do" }).map((task) => task.id)).toEqual(["assigned"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "in-progress" }).map((task) => task.id)).toEqual(["progress"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "review" }).map((task) => task.id)).toEqual(["review"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "rejected" }).map((task) => task.id)).toEqual(["returned"]);
    expect(filterCalendarTasks(tasks, { ...filters, status: "done" }).map((task) => task.id)).toEqual(["done"]);
  });

  it("maps client portal calendar tasks onto the shared calendar model", () => {
    const tasks = toClientCalendarTasks([
      {
        id: "client-task",
        title: "tax",
        status: "completed",
        plannedDueAt: "2026-08-28T00:00:00.000Z",
        serviceId: "svc-1",
        serviceName: "Demo",
        frequency: "monthly",
        priority: "normal",
        assignees: [{ id: "emp-1", name: "Rahul" }],
      },
    ]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.clientName).toBe("Demo");
    expect(tasks[0]?.status).toBe("completed");
    expect(tasks[0]?.frequency).toBe("monthly");
  });

  it("filters client tasks by service, assignee, status bucket and due window", () => {
    const gst = {
      ...withDue(sampleTask({ id: "gst", serviceName: "GST Compliance", status: "assigned" })),
      frequency: "monthly",
    };
    const tax = {
      ...withDue(sampleTask({
        id: "tax",
        serviceName: "Taxation",
        status: "completed",
        assignees: [{ id: "emp-2", name: "Priya" }],
      })),
      frequency: "annually",
    };
    const tasks = [gst, tax];

    expect(filterCalendarTasks(tasks, { ...defaultCalendarFilters(), serviceName: "GST Compliance" }).map((task) => task.id)).toEqual(["gst"]);
    expect(filterCalendarTasks(tasks, { ...defaultCalendarFilters(), employeeId: "emp-2" }).map((task) => task.id)).toEqual(["tax"]);
    expect(filterCalendarTasks(tasks, { ...defaultCalendarFilters(), clientBucket: "completed" }).map((task) => task.id)).toEqual(["tax"]);
    expect(filterCalendarTasks(tasks, { ...defaultCalendarFilters(), frequency: "monthly" }).map((task) => task.id)).toEqual(["gst"]);
    expect(clientCalendarSummary(tasks)).toEqual({ scheduled: 1, inProgress: 0, completed: 1 });
  });

  it("shows one task per day in the compact dashboard calendar", () => {
    expect(visibleTasksPerCell(true)).toBe(1);
    expect(visibleTasksPerCell(false)).toBe(3);
  });

  it("derives overdue accent and summary counts", () => {
    const overdueTask = withDue(sampleTask({ status: "assigned" }), "2020-01-01T09:00:00.000Z");

    expect(taskAccent(overdueTask)).toBe("danger");
    expect(calendarSummary([overdueTask]).overdue).toBe(1);
  });
});
