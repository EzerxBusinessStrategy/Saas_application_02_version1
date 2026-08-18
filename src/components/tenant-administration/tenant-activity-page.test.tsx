import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TenantActivityPage } from "@/components/tenant-administration/tenant-activity-page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("from=2026-04-01&to=2027-03-31"),
}));

vi.mock("@/features/tenant-admin/api/activity-api", () => ({
  listTenantAdminActivity: vi.fn(async () => ({
    period: { from: "2026-04-01", to: "2027-03-31", source: "financial_year" },
    total: 1,
    events: [
      {
        id: "activity-1",
        action: "SERVICE_CREATED",
        label: "service created",
        resourceType: "service",
        resourceId: "service-1",
        result: "succeeded",
        metadata: {},
        actor: "Sayantan",
        createdAt: "2026-08-18T10:00:00.000Z",
      },
    ],
  })),
}));

test("shows tenant-scoped activity for the selected period", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TenantActivityPage />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Service created")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Back to overview/i })).toHaveAttribute(
    "href",
    "/admin?from=2026-04-01&to=2027-03-31",
  );
});
