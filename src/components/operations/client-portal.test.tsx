import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ClientPortal } from "@/components/operations/client-portal";

function utcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString();
}

const now = new Date();
const thisMonthDueAt = utcDate(now.getUTCFullYear(), now.getUTCMonth(), 15);
const nextMonthDueAt = utcDate(now.getUTCFullYear(), now.getUTCMonth() + 1, 11);

const dashboard = {
  period: {
    from: "2026-08-01",
    to: "2027-08-17",
    source: "upcoming_year" as const,
  },
  activeServices: 1,
  pendingTasks: 1,
  completedTasks: 1,
  openRequests: 0,
  outstandingInvoices: 0,
  currencyCode: "INR",
  services: [
    {
      id: "svc-1",
      engagementName: "demo",
      serviceName: "demo",
      status: "active",
      nextDueAt: nextMonthDueAt,
      openTasks: 1,
      completedTasks: 1,
      totalTasks: 2,
      progressPercent: 50,
      assignedEmployeeName: "Ada",
      estimatedTotal: 1_920_000,
      taskTotal: 160_000,
      discountAmount: 16_000,
      discountPercent: 10,
      amountDue: 144_000,
      totalDue: 144_000,
      currencyCode: "INR",
      tasks: [
        {
          id: "t1",
          title: "GST",
          status: "completed",
          plannedDueAt: thisMonthDueAt,
          rateAmount: 10_000,
          currencyCode: "INR",
        },
        {
          id: "t2",
          title: "Monthly books",
          status: "in_progress",
          plannedDueAt: nextMonthDueAt,
          rateAmount: 150_000,
          currencyCode: "INR",
        },
      ],
    },
  ],
  requests: [],
  invoices: [],
};

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows compact service cards, next due, and a service drawer instead of an accordion", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/client-portal/dashboard")) {
        return Response.json(dashboard);
      }
      return Response.json({ message: "Not found" }, { status: 404 });
    }),
  );

  renderWithQuery(<ClientPortal section="services" />);

  expect(await screen.findByRole("heading", { name: "Active services" })).toBeInTheDocument();
  expect(screen.getByLabelText("Search services")).toBeInTheDocument();
  expect(screen.getByLabelText("Service date range")).toBeInTheDocument();
  expect(screen.queryByText("2 tasks under demo")).not.toBeInTheDocument();
  expect(screen.queryByText("GST")).not.toBeInTheDocument();
  expect(screen.getByText("Next due")).toBeInTheDocument();
  expect(screen.getByText("Monthly books")).toBeInTheDocument();
  expect(screen.getByText("Ada")).toBeInTheDocument();
  expect(screen.getByText("Billing schedule")).toBeInTheDocument();
  expect(screen.queryByText(/responsible person/i)).not.toBeInTheDocument();
  expect(screen.queryByText("On track")).not.toBeInTheDocument();
  expect(screen.queryByText("Message tenant")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Comment on demo")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /2 scheduled tasks/i }));
  expect(await screen.findByText("GST")).toBeInTheDocument();
  expect(screen.getAllByText("Monthly books").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Billing" }));
  expect(screen.getByText("Total task amount")).toBeInTheDocument();
  expect(screen.getByText("₹1,60,000")).toBeInTheDocument();
  expect(screen.getByText("Discount (10%)")).toBeInTheDocument();
  expect(screen.getByText("−₹16,000")).toBeInTheDocument();
  expect(screen.getByText("Amount due")).toBeInTheDocument();
  expect(screen.getByText("₹1,44,000")).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "Message team" })[0]!);
  expect(await screen.findByLabelText("Comment on demo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
});

test("applies a date range and reloads dashboard data from the API", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/client-portal/dashboard?from=")) {
      return Response.json({
        ...dashboard,
        period: { from: "2026-08-01", to: "2026-08-31", source: "query" },
        activeServices: 0,
        pendingTasks: 0,
        completedTasks: 0,
        services: [],
      });
    }
    if (url.includes("/api/client-portal/dashboard")) {
      return Response.json(dashboard);
    }
    return Response.json({ message: "Not found" }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  renderWithQuery(<ClientPortal />);

  expect(await screen.findByText("Monthly books")).toBeInTheDocument();
  expect(screen.getByText("Open tasks")).toBeInTheDocument();
  expect(screen.getByText("Completed")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Dashboard date preset"), { target: { value: "this_month" } });

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/client-portal\/dashboard\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/),
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  expect(await screen.findByText("No active services")).toBeInTheDocument();
  expect(screen.queryByText("GST")).not.toBeInTheDocument();
});

test("overview compact mode hides comments and the task accordion", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/client-portal/dashboard")) {
        return Response.json({
          ...dashboard,
          requests: [
            {
              id: "req-1",
              title: "GST filing",
              status: "complete",
              serviceName: "GST filing",
              countryCode: "IN",
              requestedDueDate: null,
              submittedAt: "2026-08-17T10:00:00.000Z",
              updatedAt: "2026-08-17T10:00:00.000Z",
            },
          ],
        });
      }
      return Response.json({ message: "Not found" }, { status: 404 });
    }),
  );

  renderWithQuery(<ClientPortal />);

  expect(await screen.findByRole("button", { name: "Details →" })).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByText("Ada")).toBeInTheDocument();
  expect(screen.getByText("Upcoming billing")).toBeInTheDocument();
  expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByText("2 tasks under demo")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Comment on demo")).not.toBeInTheDocument();
  expect(screen.queryByText("On track")).not.toBeInTheDocument();
});
