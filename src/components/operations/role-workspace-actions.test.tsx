import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EmployeeWorkspace } from "@/components/operations/employee-workspace";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("links employees to the real task route", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        employeeName: "abcdef",
        today: "2026-08-09T00:00:00.000Z",
        summary: { dueToday: 0, inProgress: 0, needsChanges: 0 },
        tasks: [],
        workLog: { loggedMinutes: 0, status: "not_started" },
      }),
    ),
  );

  renderWithQuery(<EmployeeWorkspace />);

  expect(
    await screen.findByRole("link", { name: /open tasks/i }),
  ).toHaveAttribute("href", "/employee/tasks");
});

