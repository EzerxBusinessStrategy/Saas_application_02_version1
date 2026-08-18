import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  calendarSummary,
  filterCalendarTasks,
  taskAccent,
  toCalendarTasks,
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

  it("derives overdue accent and summary counts", () => {
    const overdueTask = {
      ...sampleTask({ status: "assigned" }),
      dueDate: parseISO("2020-01-01T09:00:00.000Z"),
    } satisfies CalendarTask;

    expect(taskAccent(overdueTask)).toBe("danger");
    expect(calendarSummary([overdueTask]).overdue).toBe(1);
  });
});
