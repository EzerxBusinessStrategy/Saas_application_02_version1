import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { EmployeeWorkspace } from "@/components/operations/employee-workspace";

vi.mock("@/features/operations/api/operations-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/operations/api/operations-api")>()),
  listEmployeeTasks: vi.fn(async () => {
    const { operationalTasks } = await import("@/mocks/operations");
    return operationalTasks.filter((task) => task.assigneeId === "emp-riley");
  }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

test("shows assigned tasks and selected-date delivery details in an accessible employee calendar", async () => {
  renderWithQuery(<EmployeeWorkspace section="calendar" />);

  expect(
    await screen.findByRole("table", { name: /delivery calendar/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /next month/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: /tasks due tuesday, july 21/i }),
  ).toBeInTheDocument();
  expect(screen.getByText("Assigned by")).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", {
      name: /friday, july 24, 2026, 1 assigned task/i,
    }),
  );

  expect(
    screen.getByRole("heading", { name: /tasks due friday, july 24/i }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByText("Publish monthly delivery report").length,
  ).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: "Open task" })).toHaveAttribute(
    "href",
    "/employee/tasks?task=TASK-1044",
  );
});
