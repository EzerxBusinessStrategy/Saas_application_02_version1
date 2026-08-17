import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ClientPortal } from "@/components/operations/client-portal";

const dashboard = {
  activeServices: 1,
  openRequests: 0,
  outstandingInvoices: 0,
  currencyCode: "INR",
  services: [
    {
      id: "svc-1",
      engagementName: "demo",
      serviceName: "demo",
      status: "active",
      nextDueAt: null,
      openTasks: 1,
      completedTasks: 1,
      totalTasks: 2,
      progressPercent: 50,
      assignedEmployeeName: "Ada",
      estimatedTotal: 1_920_000,
      totalDue: 160_000,
      currencyCode: "INR",
      tasks: [
        {
          id: "t1",
          title: "GST",
          status: "in_progress",
          plannedDueAt: null,
          rateAmount: 10_000,
          currencyCode: "INR",
        },
        {
          id: "t2",
          title: "Monthly books",
          status: "completed",
          plannedDueAt: null,
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
  vi.unstubAllGlobals();
});

test("shows taken tasks, prices, total due, and a comment field on active services", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/client-portal/dashboard")) {
        return Response.json(dashboard);
      }
      if (url.includes("/api/client-portal/service-catalogue")) {
        return Response.json({ clientId: "client-1", clientName: "Acme", services: [] });
      }
      return Response.json({ message: "Not found" }, { status: 404 });
    }),
  );

  renderWithQuery(<ClientPortal section="services" />);

  expect(await screen.findByText("GST")).toBeInTheDocument();
  expect(screen.getByText("Monthly books")).toBeInTheDocument();
  expect(screen.getByText("Task total")).toBeInTheDocument();
  expect(screen.getByText("Total due")).toBeInTheDocument();
  expect(screen.getByLabelText("Comment on demo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send comment" })).toBeInTheDocument();
});
