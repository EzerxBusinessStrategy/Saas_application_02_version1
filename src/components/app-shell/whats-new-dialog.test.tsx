import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { WhatsNewDialog } from "@/components/app-shell/whats-new-dialog";
import { APP_VERSION } from "@/lib/app-version";

afterEach(() => {
  cleanup();
});

test("shows the latest release as a searchable drawer", () => {
  render(<WhatsNewDialog open onOpenChange={() => undefined} />);

  expect(screen.getByRole("dialog", { name: "What's new" })).toBeInTheDocument();
  expect(screen.getAllByText(`v${APP_VERSION}`).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Latest").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Initial platform release").length).toBeGreaterThan(0);
  expect(screen.getByText("Role-based workspaces")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Search updates...")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
});

test("filters release items by search", () => {
  render(<WhatsNewDialog open onOpenChange={() => undefined} />);

  fireEvent.change(screen.getByPlaceholderText("Search updates..."), {
    target: { value: "calendar" },
  });

  expect(screen.getByText("Tasks and calendar")).toBeInTheDocument();
  expect(screen.queryByText("Role-based workspaces")).not.toBeInTheDocument();
});
