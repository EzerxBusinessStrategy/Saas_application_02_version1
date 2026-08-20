import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { PlatformOverviewDashboard } from "@/components/dashboard/platform-overview-dashboard";
import type { SuperAdminDashboardData } from "@/types/platform-overview";

const mockApi = vi.hoisted(() => ({
  getSuperAdminDashboard: vi.fn(),
}));
vi.mock("@/features/platform/api/super-admin-dashboard-api", () => mockApi);
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
        tenantStatus: "pending_activation",
        tenantAdministratorLastLoginAt: null,
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
      tenantStatuses: ["pending_activation"],
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
  expect(screen.getAllByText("Not Logged In").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Page context: Super Admin")).toBeInTheDocument();
  expect(screen.getByLabelText("Actions for ABC Technologies")).toBeInTheDocument();
  expect(screen.getByText("View tenant")).toBeInTheDocument();
  fireEvent.click(screen.getByText("View tenant"));
  expect(await screen.findByText("Tenant details")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
});

test("submits tenant search only after the search action and shows a no-results message", async () => {
  const dashboard: SuperAdminDashboardData = {
    superAdmin: { id: "user-1", name: "Super Admin", email: "superadmin@example.com", initials: "SA" },
    metrics: { totalTenants: 1, totalTurnoverByCurrency: [], collectedByCurrency: [], outstandingByCurrency: [], lowHealthTenants: 0 },
    platformStatus: { activeTenants: 1, suspendedTenants: 0, pendingTenantReviews: 0, activeTenantUsers: 1 },
    tenantHealth: [],
    recentActivity: [],
    platformAlerts: [],
    tenantReviews: [],
    turnoverTrend: [],
    filterOptions: { financialYears: [], countries: [], healthBands: [], healthCounts: [], tenantStatuses: [] },
    appliedFilters: { from: null, to: null, periodMode: "CURRENT_FY", financialYearId: null, health: null, tenantStatus: null, country: null, search: null },
  };
  mockApi.getSuperAdminDashboard.mockResolvedValue(dashboard);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <PlatformOverviewDashboard />
    </QueryClientProvider>,
  );

  await screen.findByText("Tenant Turnover Health");
  fireEvent.change(screen.getByPlaceholderText("Search tenant..."), { target: { value: "abc" } });

  expect(mockApi.getSuperAdminDashboard).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Tenant Turnover Health")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Search tenants" }));

  await waitFor(() => {
    expect(mockApi.getSuperAdminDashboard).toHaveBeenLastCalledWith({ search: "abc" });
  });
  expect(await screen.findByText('No tenant found for "abc"')).toBeInTheDocument();
});
