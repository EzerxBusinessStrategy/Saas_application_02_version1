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
          discountAmount: 1_000,
          discountType: "percentage",
          discountValue: 10,
          currencyCode: "INR",
        },
        {
          id: "t2",
          title: "Monthly books",
          status: "in_progress",
          plannedDueAt: nextMonthDueAt,
          rateAmount: 150_000,
          discountAmount: 15_000,
          discountType: "percentage",
          discountValue: 10,
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

test("shows this month due, next month due, monthly prices, and total without internal staffing labels", async () => {
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

  expect(await screen.findByText("GST")).toBeInTheDocument();
  expect(screen.getByText("Monthly books")).toBeInTheDocument();
  expect(screen.getByText(/This month due/)).toBeInTheDocument();
  expect(screen.getByText(/Next month due/)).toBeInTheDocument();
  expect(screen.getByText(/· This month/)).toBeInTheDocument();
  expect(screen.getByText(/· Next month/)).toBeInTheDocument();
  expect(screen.getByText("₹0.00")).toBeInTheDocument();
  expect(screen.getByText("₹10,000.00")).toBeInTheDocument();
  expect(screen.getAllByText("₹1,50,000.00").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("Total task amount")).toBeInTheDocument();
  expect(screen.getByText("₹1,60,000.00")).toBeInTheDocument();
  expect(screen.getByText("Discount (10%)")).toBeInTheDocument();
  expect(screen.getByText("−₹16,000.00")).toBeInTheDocument();
  expect(screen.getByText("Amount due")).toBeInTheDocument();
  expect(screen.getByText("₹1,44,000.00")).toBeInTheDocument();
  expect(screen.queryByText(/responsible person/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  expect(screen.queryByText("₹19,20,000.00")).not.toBeInTheDocument();
  expect(screen.queryByText("Total due")).not.toBeInTheDocument();
  expect(screen.queryByText("Task total")).not.toBeInTheDocument();
  expect(screen.queryByText("Service catalogue")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Comment on demo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send comment" })).toBeInTheDocument();
});

test("applies a date range and reloads dashboard data from the API", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("from=2026-09-01") && url.includes("to=2026-09-30")) {
      return Response.json({
        ...dashboard,
        period: { from: "2026-09-01", to: "2026-09-30", source: "query" },
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

  expect(await screen.findByText("GST")).toBeInTheDocument();
  expect(screen.getByText("Pending tasks")).toBeInTheDocument();
  expect(screen.getByText("Completed tasks")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Dashboard from date"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("Dashboard to date"), { target: { value: "2026-09-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/client-portal/dashboard?from=2026-09-01&to=2026-09-30",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  expect(await screen.findByText("No active services")).toBeInTheDocument();
  expect(screen.queryByText("GST")).not.toBeInTheDocument();
});
