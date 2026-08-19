import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NotificationMenu } from "@/components/app-shell/notification-menu";
import { getClientPortalNotifications } from "@/features/client-portal/api/client-portal-notifications-api";
import { getEmployeeNotifications } from "@/features/employee/api/employee-notifications-api";
import { getSuperAdminNotifications } from "@/features/platform/api/super-admin-notifications-api";
import { getTenantAdminNotifications } from "@/features/tenant-admin/api/tenant-admin-notifications-api";
import type { SuperAdminNotification } from "@/types/super-admin-notifications";

vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));

vi.mock("@/features/platform/api/super-admin-notifications-api", () => ({
  getSuperAdminNotifications: vi.fn(),
  markAllSuperAdminNotificationsRead: vi.fn(),
  markSuperAdminNotificationRead: vi.fn(),
}));

vi.mock("@/features/tenant-admin/api/tenant-admin-notifications-api", () => ({
  getTenantAdminNotifications: vi.fn(),
  markAllTenantAdminNotificationsRead: vi.fn(),
  markTenantAdminNotificationRead: vi.fn(),
}));

vi.mock("@/features/employee/api/employee-notifications-api", () => ({
  getEmployeeNotifications: vi.fn(),
  markAllEmployeeNotificationsRead: vi.fn(),
  markEmployeeNotificationRead: vi.fn(),
}));

vi.mock("@/features/client-portal/api/client-portal-notifications-api", () => ({
  getClientPortalNotifications: vi.fn(),
}));

function notification(overrides: Partial<SuperAdminNotification>): SuperAdminNotification {
  return {
    id: "notice-1",
    type: "TASK_ASSIGNED",
    title: "Unread notice",
    message: "A task needs attention.",
    severity: "INFO",
    tenantId: "tenant-1",
    actionUrl: "/admin",
    createdAt: "2026-08-18T10:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

function mixedPage(count = 2) {
  const items = Array.from({ length: count }, (_, index) =>
    notification({
      id: `notice-${index + 1}`,
      title: index === 0 ? "Unread notice" : `Notice ${index + 1}`,
      readAt: index === 0 ? null : "2026-08-18T09:00:00.000Z",
    }),
  );
  return { unreadCount: 1, items };
}

function renderMenu(workspace: "super-admin" | "admin" | "manager" | "employee" | "client") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationMenu workspace={workspace} open userEmail="user@example.com" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "Audio",
    class {
      volume = 0;
      currentTime = 0;
      play() {
        return Promise.resolve();
      }
    },
  );
  vi.mocked(getSuperAdminNotifications).mockResolvedValue(mixedPage());
  vi.mocked(getTenantAdminNotifications).mockResolvedValue(mixedPage());
  vi.mocked(getEmployeeNotifications).mockResolvedValue(mixedPage());
  vi.mocked(getClientPortalNotifications).mockResolvedValue(mixedPage());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test.each([
  ["super-admin", getSuperAdminNotifications],
  ["admin", getTenantAdminNotifications],
  ["employee", getEmployeeNotifications],
  ["manager", getEmployeeNotifications],
  ["client", getClientPortalNotifications],
] as const)("loads the last 20 read and unread notifications for %s", async (workspace, loader) => {
  renderMenu(workspace);

  expect(await screen.findByText("Unread notice")).toBeInTheDocument();
  expect(screen.getByText("Notice 2")).toBeInTheDocument();
  expect(screen.getByLabelText("Unread")).toBeInTheDocument();
  expect(loader).toHaveBeenCalledWith({ status: "ALL", limit: 20 });
});

test("caps the bell list at 20 notifications", async () => {
  vi.mocked(getTenantAdminNotifications).mockResolvedValue(mixedPage(21));
  renderMenu("admin");

  expect(await screen.findByText("Unread notice")).toBeInTheDocument();
  expect(screen.getAllByRole("menuitem")).toHaveLength(21);
  expect(screen.queryByText("Notice 21")).not.toBeInTheDocument();
});

test("wires the tenant bell as an openable menu trigger", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NotificationMenu workspace="admin" userEmail="user@example.com" />
    </QueryClientProvider>,
  );

  const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
  expect(bell).toHaveAttribute("aria-haspopup", "menu");
  expect(bell).toHaveAttribute("aria-expanded", "false");
});
