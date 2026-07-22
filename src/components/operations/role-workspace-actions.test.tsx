import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import {
  listOperationalTasks,
  submitEmployeeTaskForReview,
} from "@/features/operations/api/operations-api";
import { ClientPortal } from "@/components/operations/client-portal";
import { EmployeeWorkspace } from "@/components/operations/employee-workspace";
import { ManagerWorkspace } from "@/components/operations/manager-workspace";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

test("links employees to the real work-log route", async () => {
  renderWithQuery(<EmployeeWorkspace />);

  expect(
    await screen.findByRole("link", { name: /add work log/i }),
  ).toHaveAttribute("href", "/employee/work-logs");
});

test("records manager notification acknowledgement for the current mock session", async () => {
  renderWithQuery(<ManagerWorkspace section="notifications" />);

  fireEvent.click(
    await screen.findByRole("button", { name: /mark updates reviewed/i }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Updates marked as reviewed for this mock session.",
  );
});

test("opens the professional client support-ticket form", async () => {
  renderWithQuery(<ClientPortal section="support" />);

  fireEvent.click(
    await screen.findByRole("button", { name: /raise support ticket/i }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Raise support ticket",
  );
  expect(screen.getByLabelText("Describe the issue")).toBeInTheDocument();
});

test("notifies the assigned manager and completes an approved employee task", async () => {
  await submitEmployeeTaskForReview("TASK-1042");
  renderWithQuery(<ManagerWorkspace section="notifications" />);

  expect(
    await screen.findByText(/1 employee task review needs your attention/i),
  ).toBeInTheDocument();

  renderWithQuery(<ManagerWorkspace section="reviews" />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Approve Confirm onboarding checklist",
    }),
  );

  await waitFor(async () => {
    const task = (await listOperationalTasks("employee")).find(
      (item) => item.id === "TASK-1042",
    );
    expect(task?.status).toBe("done");
  });
});
