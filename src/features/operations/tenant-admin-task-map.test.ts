import { describe, expect, test } from "vitest";
import type { TenantAdminTask } from "@/features/operations/api/operations-api";
import {
  isTenantAdminTaskAwaitingReview,
  mapAllocatedWorkToOperationalTask,
  mapTenantAdminTask,
  tenantTaskReviewHref,
} from "@/features/operations/tenant-admin-task-map";

function task(overrides: Partial<TenantAdminTask> = {}): TenantAdminTask {
  return {
    id: "task-1",
    title: "GST filing",
    description: "File GST",
    clientId: "client-1",
    clientName: "Acme",
    serviceId: "service-1",
    serviceName: "GST",
    workGroupId: "group-1",
    workGroupName: "Compliance",
    priority: "normal",
    status: "manager_review",
    slaStatus: "running",
    plannedDueAt: null,
    assigneeCount: 1,
    assignees: [{ id: "employee-1", name: "Rahul" }],
    latestSubmissionStatus: "submitted",
    latestReviewRemarks: null,
    managerName: "Anita",
    ...overrides,
  };
}

describe("tenant admin task review mapping", () => {
  test("builds a tenant task review deep link", () => {
    expect(tenantTaskReviewHref()).toBe("/admin/task-review");
    expect(tenantTaskReviewHref("task-1")).toBe("/admin/task-review?task=task-1");
  });

  test("treats employee submissions as awaiting tenant review", () => {
    expect(isTenantAdminTaskAwaitingReview(task({ status: "manager_review" }))).toBe(true);
    expect(isTenantAdminTaskAwaitingReview(task({ status: "tenant_approval" }))).toBe(true);
    expect(isTenantAdminTaskAwaitingReview(task({ status: "completed" }))).toBe(false);
    expect(
      isTenantAdminTaskAwaitingReview(
        task({ status: "manager_review", latestSubmissionStatus: "returned" }),
      ),
    ).toBe(false);
  });

  test("maps pending review tasks onto the review board column", () => {
    const mapped = mapTenantAdminTask(task({ status: "tenant_approval" }));
    expect(mapped.status).toBe("review");
    expect(mapped.reviewStatus).toBe("pending");
    expect(mapped.approvalStatus).toBe("pending");
    expect(mapped.assignee).toBe("Rahul");
    expect(mapped.manager).toBe("Anita");
  });

  test("marks allocated work as at-risk from the register flag", () => {
    const mapped = mapAllocatedWorkToOperationalTask({
      id: "task-1",
      title: "GST filing",
      description: "File GST",
      clientId: "client-1",
      clientName: "Acme",
      clientPublicIp: null,
      employeePublicIp: "203.0.113.20",
      serviceId: "service-1",
      serviceName: "GST",
      workGroupId: null,
      workGroupName: null,
      priority: "normal",
      status: "assigned",
      slaStatus: "running",
      plannedDueAt: "2026-08-01T00:00:00.000Z",
      createdAt: "2026-07-01T00:00:00.000Z",
      assignedAt: "2026-07-02T00:00:00.000Z",
      completedAt: null,
      assignees: [{ id: "employee-1", name: "Rahul", assignedAt: "2026-07-02T00:00:00.000Z" }],
      atRisk: true,
      atRiskReasons: ["Due date has passed."],
    });
    expect(mapped.client).toBe("Acme");
    expect(mapped.engagement).toBe("GST");
    expect(mapped.sla).toBe("at-risk");
  });
});
