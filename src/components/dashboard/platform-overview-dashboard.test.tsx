import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { PlatformOverviewDashboard } from "@/components/dashboard/platform-overview-dashboard";
import type { SuperAdminDashboardData } from "@/types/platform-overview";

const mockApi = vi.hoisted(() => ({
  getSuperAdminDashboard: vi.fn(),
}));

vi.mock("@/features/platform/api/super-admin-dashboard-api", () => mockApi);

test("renders live Super Admin turnover dashboard sections", async () => {
  const dashboard: SuperAdminDashboardData = {
    superAdmin: {
      id: "user-1",
      name: "Super Admin",
      email: "superadmin@example.com",
      initials: "SA",
    },
    metrics: {
      totalTenants: 1,
      totalTurnoverByCurrency: [{ currencyCode: "INR", amount: "4200000.00" }],
      collectedByCurrency: [{ currencyCode: "INR", amount: "3600000.00" }],
      outstandingByCurrency: [{ currencyCode: "INR", amount: "600000.00" }],
      lowHealthTenants: 0,
    },
    platformStatus: {
      activeTenants: 1,
      suspendedTenants: 0,
      pendingTenantReviews: 0,
      activeTenantUsers: 3,
    },
    tenantHealth: [
      {
        tenantId: "tenant-1",
        tenantName: "ABC Technologies",
        country: "IN",
        tenantStatus: "active",
        currencyCode: "INR",
        turnover: "4200000.00",
        collected: "3600000.00",
        outstanding: "600000.00",
        growthPercentage: null,
        collectionRate: 85.7,
        invoiceCount: 4,
        activeUsers: 3,
        health: "HEALTHY",
        healthLabel: "Healthy",
        financialCondition: "GOOD",
        financialYear: {
          id: "fy-2026-27",
          label: "FY 2026-27",
          startDate: "2026-04-01",
          endDate: "2027-03-31",
        },
        financialYears: [
          {
            id: "fy-2026-27",
            label: "FY 2026-27",
            startDate: "2026-04-01",
            endDate: "2027-03-31",
          },
        ],
      },
    ],
    recentActivity: [],
    platformAlerts: [],
    tenantReviews: [],
    turnoverTrend: [
      {
        tenantId: "tenant-1",
        month: "Apr 2026",
        currencyCode: "INR",
        turnover: "4200000.00",
      },
    ],
    filterOptions: {
      financialYears: [
        {
          id: "fy-2026-27",
          label: "FY 2026-27",
          startDate: "2026-04-01",
          endDate: "2027-03-31",
        },
      ],
      countries: ["IN"],
      healthBands: [
        {
          code: "HEALTHY",
          label: "Healthy",
          minimumTurnover: 2000000,
          maximumTurnover: 5000000,
        },
      ],
      healthCounts: [
        { code: null, label: "All Health Levels", count: 1 },
        { code: "HEALTHY", label: "Healthy", count: 1 },
      ],
      tenantStatuses: ["active"],
    },
    appliedFilters: {
      from: null,
      to: null,
      periodMode: "CURRENT_FY",
      financialYearId: null,
      health: null,
      tenantStatus: null,
      country: null,
      search: null,
    },
  };
  mockApi.getSuperAdminDashboard.mockResolvedValueOnce(dashboard);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <PlatformOverviewDashboard />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Tenant Turnover Health")).toBeInTheDocument();
  expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  expect(screen.getByText("View full audit log")).toBeInTheDocument();
  expect(screen.getByText("Total turnover")).toBeInTheDocument();
  expect(screen.getByText("Platform Status")).toBeInTheDocument();
  expect(screen.getByText("Tenant Financial Details")).toBeInTheDocument();
  expect(screen.getAllByText("ABC Technologies").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Page context: Super Admin")).toBeInTheDocument();
});
