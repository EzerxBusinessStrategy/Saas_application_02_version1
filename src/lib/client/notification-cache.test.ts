import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readNotificationCache, writeNotificationCache } from "@/lib/client/notification-cache";

const response = {
  unreadCount: 1,
  items: [{
    id: "notice-1",
    type: "TENANT_CREATED",
    title: "New tenant created",
    message: "A tenant is ready.",
    severity: "INFO" as const,
    tenantId: "tenant-1",
    actionUrl: "/super-admin/tenants/tenant-1",
    createdAt: "2026-08-12T00:00:00.000Z",
    readAt: null,
  }],
};

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-12T00:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

test("retains a notification response for the same workspace and user", () => {
  writeNotificationCache("super-admin", "admin@example.com", response);

  expect(readNotificationCache("super-admin", "admin@example.com")).toEqual(response);
  expect(readNotificationCache("super-admin", "other@example.com")).toBeUndefined();
});

test("expires cached notifications after 48 hours", () => {
  writeNotificationCache("employee", "employee@example.com", response);
  vi.advanceTimersByTime(48 * 60 * 60 * 1000 + 1);

  expect(readNotificationCache("employee", "employee@example.com")).toBeUndefined();
});
