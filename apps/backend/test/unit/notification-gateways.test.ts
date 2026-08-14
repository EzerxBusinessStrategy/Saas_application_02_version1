import { expect, test } from "vitest";
import { EmployeeNotificationsGateway } from "../../src/platform/employee-notifications.gateway";
import { TenantAdminNotificationsGateway } from "../../src/platform/tenant-admin-notifications.gateway";

function notificationItem() {
  return {
    id: "notification-1",
    type: "TASK_SUBMITTED_FOR_MANAGER_REVIEW",
    title: "Task ready for review",
    message: "Review the task.",
    severity: "INFO" as const,
    tenantId: "tenant-1",
    actionUrl: "/employee/task-reviews",
    createdAt: "2026-08-14T00:00:00.000Z",
    readAt: null,
  };
}

test("employee notification gateway emits through its Socket.IO namespace adapter", () => {
  const emitted: unknown[][] = [];
  const gateway = new EmployeeNotificationsGateway({} as never, {} as never);
  (gateway as unknown as { server?: unknown }).server = {
    adapter: { rooms: new Map([["tenant:tenant-1:user:user-1", new Set(["socket-1"]) ]]) },
    to: () => ({ emit: (...args: unknown[]) => emitted.push(args) }),
  };

  expect(gateway.emitNewNotification("user-1", "tenant-1", notificationItem())).toBe(1);
  expect(emitted).toEqual([["notification:new", notificationItem()]]);
});

test("tenant-admin notification gateway emits through its Socket.IO namespace adapter", () => {
  const emitted: unknown[][] = [];
  const gateway = new TenantAdminNotificationsGateway({} as never, {} as never, { markDelivered: async () => undefined } as never);
  (gateway as unknown as { server?: unknown }).server = {
    adapter: { rooms: new Map([["tenant:tenant-1:user:user-1", new Set(["socket-1"]) ]]) },
    to: () => ({ emit: (...args: unknown[]) => emitted.push(args) }),
  };

  expect(gateway.emitNewNotification("user-1", "tenant-1", notificationItem())).toBe(1);
  expect(emitted).toEqual([["notification:new", notificationItem()]]);
});
