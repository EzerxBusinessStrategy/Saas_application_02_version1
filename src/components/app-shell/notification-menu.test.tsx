import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { NotificationMenu } from "@/components/app-shell/notification-menu";

afterEach(cleanup);

test("shows unread notification count and the empty notification state", () => {
  const { rerender } = render(<NotificationMenu workspace="super-admin" />);
  const trigger = screen.getByLabelText("Notifications, 2 unread");
  expect(trigger).toBeInTheDocument();
  expect(trigger.querySelector(".super-admin-notification-signal"))
    .toBeInTheDocument();
  rerender(
    <NotificationMenu
      key="empty"
      workspace="admin"
      state="empty"
      initialItems={[]}
      open
    />,
  );
  expect(screen.getByText("You\u0027re all caught up.")).toBeInTheDocument();
});
