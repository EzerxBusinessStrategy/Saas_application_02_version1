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
import { SupportTicketWorkspace } from "@/components/operations/support-ticket-workspace";

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
    await screen.findByRole("button", { name: /create support request/i }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Create a support request",
  );
  expect(screen.getByLabelText("Describe the issue")).toBeInTheDocument();
  expect(screen.getByLabelText("Business impact")).toBeInTheDocument();
  expect(
    screen.getByRole("form", { name: "Create support request" }),
  ).toHaveClass("scrollbar-none");
  expect(screen.getByText("Company")).toBeInTheDocument();
  fireEvent.change(
    screen.getByPlaceholderText("Example: Unable to download the GST filing report"),
    {
    target: { value: "Hi" },
    },
  );
  fireEvent.change(screen.getByLabelText("Describe the issue"), {
    target: { value: "Help" },
  });
  expect(
    screen.getByRole("button", { name: "Submit request" }),
  ).toBeEnabled();
});

test("labels the manager employee-assignment control", async () => {
  renderWithQuery(<SupportTicketWorkspace workspace="manager" />);

  fireEvent.click(await screen.findByRole("button", { name: "View request" }));
  expect(screen.getByLabelText("Assign employee")).toBeInTheDocument();
});

test("notifies the assigned manager and submits approved employee work for tenant approval", async () => {
  await submitEmployeeTaskForReview("TASK-1042");
  renderWithQuery(<ManagerWorkspace section="notifications" />);

  expect(
    await screen.findByText(/1 employee task review needs your attention/i),
  ).toBeInTheDocument();

  renderWithQuery(<ManagerWorkspace section="reviews" />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Submit Confirm onboarding checklist for tenant approval",
    }),
  );

  await waitFor(async () => {
    const task = (await listOperationalTasks("employee")).find(
      (item) => item.id === "TASK-1042",
    );
    expect(task).toMatchObject({
      status: "review",
      reviewStatus: "approved",
      approvalStatus: "pending",
    });
  });
});
