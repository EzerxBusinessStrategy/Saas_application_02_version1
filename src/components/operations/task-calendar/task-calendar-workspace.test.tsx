import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { addDays, format } from "date-fns";
import { afterEach, expect, test, vi } from "vitest";
import { TaskCalendarEventCard } from "@/components/operations/task-calendar/task-calendar-event-card";
import { TaskCalendarWorkspace } from "@/components/operations/task-calendar/task-calendar-workspace";

vi.mock("@/features/operations/api/operations-api", () => ({
  listTenantAdminTasks: vi.fn(async () => []),
  listTenantAdminTaskOptions: vi.fn(async () => ({ employees: [], clients: [] })),
}));

vi.mock("@/features/client-portal/api/client-portal-task-calendar-api", () => ({
  getClientPortalTaskCalendar: vi.fn(async () => ({
    period: { from: "2026-08-01", to: "2026-08-31" },
    total: 2,
    tasks: [
      {
        id: "gst-1",
        title: "GST Filing",
        status: "assigned",
        plannedDueAt: new Date().toISOString(),
        serviceId: "svc-gst",
        serviceName: "GST Compliance",
        frequency: "monthly",
        priority: "normal",
        assignees: [{ id: "emp-1", name: "Rahul" }],
      },
      {
        id: "done-1",
        title: "Annual return",
        status: "completed",
        plannedDueAt: new Date().toISOString(),
        serviceId: "svc-tax",
        serviceName: "Taxation",
        frequency: "annually",
        priority: "normal",
        assignees: [{ id: "emp-2", name: "Priya" }],
      },
    ],
  })),
}));

afterEach(() => {
  cleanup();
});

test("lets the user select any month day, including empty cells", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TaskCalendarWorkspace />
    </QueryClientProvider>,
  );

  const otherDay = addDays(new Date(), 1);
  const otherLabel = format(otherDay, "EEEE, d MMMM yyyy");
  const otherButton = await screen.findByRole("button", { name: new RegExp(otherLabel) });

  fireEvent.click(otherButton);

  expect(otherButton).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: new RegExp(format(new Date(), "EEEE, d MMMM yyyy")) })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("client calendar loads from the client portal API and keeps day selection", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TaskCalendarWorkspace audience="client" />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Client portal")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "month" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "week" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "agenda" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Filter calendar by status")).not.toBeInTheDocument();

  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy");
  const todayButton = await screen.findByRole("button", { name: new RegExp(todayLabel) });
  fireEvent.click(todayButton);
  expect(todayButton).toHaveAttribute("aria-pressed", "true");
});

test("client KPI cards toggle a scheduled status chip", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TaskCalendarWorkspace audience="client" />
    </QueryClientProvider>,
  );

  const scheduled = await screen.findByRole("button", { name: "Scheduled, 1" });
  fireEvent.click(scheduled);
  expect(scheduled).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Active filters")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Scheduled" }));
  expect(screen.queryByText("Active filters")).not.toBeInTheDocument();
  expect((await screen.findAllByText("GST Filing")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("GST Compliance").length).toBeGreaterThan(0);
});

test("client calendar event cards show service, assignee, and status", () => {
  render(
    <TaskCalendarEventCard
      audience="client"
      compact
      task={{
        id: "gst-1",
        title: "GST Filing",
        description: null,
        clientId: "",
        clientName: "GST Compliance",
        serviceId: "svc-gst",
        serviceName: "GST Compliance",
        workGroupId: null,
        workGroupName: null,
        priority: "normal",
        status: "assigned",
        slaStatus: "running",
        plannedDueAt: "2026-08-19T00:00:00.000Z",
        assigneeCount: 1,
        assignees: [{ id: "emp-1", name: "Rahul" }],
        latestSubmissionStatus: null,
        latestReviewRemarks: null,
        dueDate: addDays(new Date(), 3),
        frequency: "monthly",
      }}
    />,
  );

  expect(screen.getByText("GST Filing")).toBeInTheDocument();
  expect(screen.getByText("GST Compliance")).toBeInTheDocument();
  expect(screen.getByText("Rahul \u00b7 Scheduled")).toBeInTheDocument();
});
