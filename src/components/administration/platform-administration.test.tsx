import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  PlatformConfiguration,
  PlatformReports,
} from "@/components/administration/platform-administration";
import type { SuperAdminDashboardData } from "@/types/platform-overview";

const mockDashboardApi = vi.hoisted(() => ({
  getSuperAdminDashboard: vi.fn(),
}));

const mockPlatformConfigurationApi = vi.hoisted(() => ({
  getPlatformConfiguration: vi.fn(),
  updatePlatformConfiguration: vi.fn(),
}));

vi.mock("@/features/platform/api/super-admin-dashboard-api", () => mockDashboardApi);
vi.mock("@/features/platform/api/super-admin-platform-configuration-api", () => mockPlatformConfigurationApi);
vi.mock("@/features/identity/api/current-user-api", () => ({
  useCurrentUser: () => ({
    data: { user: { displayName: "Platform Administrator", email: "admin@example.com" }, roles: ["SUPER_ADMIN"] },
    isPending: false,
  }),
  currentUserQueryKey: (portal: string) => ["me", portal],
  uploadCurrentUserAvatar: vi.fn(),
  removeCurrentUserAvatar: vi.fn(),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.style.removeProperty("--primary");
  document.documentElement.style.removeProperty("--ring");
});

test("renders database-backed tenant usage in the global platform report", async () => {
  const dashboard: SuperAdminDashboardData = {
    superAdmin: { id: "admin-1", name: "Super Admin", email: "admin@example.com", initials: "SA" },
    metrics: { totalTenants: 1, totalTurnoverByCurrency: [], collectedByCurrency: [], outstandingByCurrency: [], lowHealthTenants: 0 },
    platformStatus: { activeTenants: 1, suspendedTenants: 0, pendingTenantReviews: 0, activeTenantUsers: 7 },
    tenantHealth: [{ tenantId: "tenant-1", tenantName: "ABC Technologies", country: "GB", tenantStatus: "active", currencyCode: "GBP", turnover: "0.00", collected: "0.00", outstanding: "0.00", growthPercentage: null, collectionRate: 0, invoiceCount: 0, activeUsers: 7, health: "LOW", healthLabel: "Low", financialCondition: "AT_RISK", financialYear: null, financialYears: [] }],
    recentActivity: [], platformAlerts: [], tenantReviews: [], turnoverTrend: [],
    filterOptions: { financialYears: [], countries: ["GB"], healthBands: [], healthCounts: [], tenantStatuses: ["active"] },
    appliedFilters: { from: null, to: null, periodMode: "CURRENT_FY", financialYearId: null, health: null, tenantStatus: null, country: null, search: null },
  };
  mockDashboardApi.getSuperAdminDashboard.mockResolvedValueOnce(dashboard);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={client}>
      <PlatformReports />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("ABC Technologies")).toBeInTheDocument();
  expect(mockDashboardApi.getSuperAdminDashboard).toHaveBeenCalledWith({});
  expect(
    screen.getByLabelText("Page context: Super Admin"),
  ).toBeInTheDocument();
  expect(container.querySelector(".super-admin-surface")).toBeInTheDocument();
  expect(
    screen.getByRole("list", { name: "Tenant active-user counts" }),
  ).toBeInTheDocument();
});

test("persists platform configuration through the API", async () => {
  mockPlatformConfigurationApi.getPlatformConfiguration.mockResolvedValueOnce({
    platformName: "SaaS App",
    defaultBrand: "#3C50E0",
    senderName: "SaaS App",
  });
  mockPlatformConfigurationApi.updatePlatformConfiguration.mockResolvedValueOnce({
    platformName: "SaaS App",
    defaultBrand: "#9AA4C6",
    senderName: "SaaS App",
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformConfiguration />
    </QueryClientProvider>,
  );

  await screen.findByLabelText("Platform name");

  fireEvent.change(screen.getByLabelText("Platform name"), {
    target: { value: "SaaS App" },
  });
  fireEvent.change(
    screen.getByLabelText("Default brand colour hexadecimal value"),
    {
      target: { value: "#9AA4C6" },
    },
  );
  expect(screen.getByText("RGB 154, 164, 198")).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Publish platform configuration" }),
  );

  expect(
    await screen.findByText(/Saved to the platform database/),
  ).toBeInTheDocument();
  expect(
    mockPlatformConfigurationApi.updatePlatformConfiguration,
  ).toHaveBeenCalledWith(
    {
      platformName: "SaaS App",
      defaultBrand: "#9AA4C6",
      senderName: "SaaS App",
    },
    expect.anything(),
  );
});
