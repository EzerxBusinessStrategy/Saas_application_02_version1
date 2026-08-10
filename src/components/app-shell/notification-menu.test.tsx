import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { NotificationMenu } from "@/components/app-shell/notification-menu";
import { getSuperAdminNotifications } from "@/features/platform/api/super-admin-notifications-api";

vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));

vi.mock("@/features/platform/api/super-admin-notifications-api", () => ({
  getSuperAdminNotifications: vi.fn(),
  markAllSuperAdminNotificationsRead: vi.fn(),
  markSuperAdminNotificationRead: vi.fn(),
}));

afterEach(cleanup);

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

test("shows unread notification count and the empty notification state", async () => {
  vi.mocked(getSuperAdminNotifications).mockResolvedValue({
    unreadCount: 2,
    items: [],
  });

  const { rerender } = renderWithQuery(<NotificationMenu workspace="super-admin" />);
  const trigger = await screen.findByLabelText("Notifications, 2 unread");
  expect(trigger).toBeInTheDocument();
  expect(trigger.querySelector(".super-admin-notification-signal"))
    .toBeInTheDocument();
  rerender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NotificationMenu
        key="empty"
        workspace="manager"
        state="empty"
        initialItems={[]}
        open
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText("You\u0027re all caught up.")).toBeInTheDocument();
});
