import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { addDays, format } from "date-fns";
import { expect, test, vi } from "vitest";
import { TaskCalendarWorkspace } from "@/components/operations/task-calendar/task-calendar-workspace";

vi.mock("@/features/operations/api/operations-api", () => ({
  listTenantAdminTasks: vi.fn(async () => []),
  listTenantAdminTaskOptions: vi.fn(async () => ({ employees: [], clients: [] })),
}));

test("lets the user select any month day, including empty cells", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TaskCalendarWorkspace />
    </QueryClientProvider>,
  );

  const otherDay = addDays(new Date(), 1);
  const otherLabel = format(otherDay, "EEEE, d MMMM yyyy");
  const otherButton = await screen.findByRole("button", { name: otherLabel });

  fireEvent.click(otherButton);

  expect(otherButton).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: format(new Date(), "EEEE, d MMMM yyyy") })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
