import { describe, expect, it, vi } from "vitest";
import { RequestContext } from "../../src/auth/request-context";
import { TenantAdminDashboardService } from "../../src/platform/tenant-admin-dashboard.service";
import { TenantAdminDashboardRepository } from "../../src/platform/tenant-admin-dashboard.repository";

describe("TenantAdminDashboardService", () => {
  it("rejects non-tenant or platform-admin request context", async () => {
    const repository = { getDashboardData: vi.fn() } as unknown as TenantAdminDashboardRepository;
    const service = new TenantAdminDashboardService(repository);

    const platformContext: RequestContext = {
      userId: "user-1",
      email: "admin@example.com",
      isPlatformAdmin: true,
      roles: ["SUPER_ADMIN"],
      permissions: [],
      requestId: "req-1",
    };

    await expect(service.getDashboard(platformContext)).rejects.toThrow("Selected portal is not available for this membership.");
    expect(repository.getDashboardData).not.toHaveBeenCalled();
  });

  it("formats dashboard metrics and enforces null SLA/utilisation when missing", async () => {
    const repository = {
      getDashboardData: vi.fn().mockResolvedValue({
        tenant: { id: "tenant-1", name: "Acme Corp", currencyCode: "INR" },
        financialYear: { id: "fy-1", label: "FY 2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31" },
        metrics: {
          activeClients: 5,
          totalSalesAmount: "125000.00",
          collectedAmount: "100000.00",
          outstandingAmount: "25000.00",
          currencyCode: "INR",
          openTasks: 12,
          overdueTasks: 2,
          slaCompliancePercent: null,
          employeeUtilisationPercent: null,
        },
        recentActivity: [
          { action: "Created tenant invoice", actor: "Priya Nair", createdAt: new Date("2026-08-05T10:00:00Z") },
        ],
      }),
    } as unknown as TenantAdminDashboardRepository;

    const service = new TenantAdminDashboardService(repository);

    const tenantAdminContext: RequestContext = {
      userId: "user-2",
      tenantId: "tenant-1",
      membershipId: "member-1",
      email: "tenantadmin@acme.com",
      isPlatformAdmin: false,
      roles: ["TENANT_ADMIN"],
      permissions: ["tenant.read"],
      requestId: "req-2",
    };

    const result = await service.getDashboard(tenantAdminContext);

    expect(result.tenant).toEqual({ id: "tenant-1", name: "Acme Corp", currencyCode: "INR" });
    expect(result.financialYear?.label).toBe("FY 2026-27");
    expect(result.metrics.totalSales).toEqual({ amount: "125000.00", currencyCode: "INR" });
    expect(result.metrics.outstanding).toEqual({ amount: "25000.00", currencyCode: "INR" });
    expect(result.metrics.slaCompliancePercent).toBeNull();
    expect(result.metrics.employeeUtilisationPercent).toBeNull();
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].actor).toBe("Priya Nair");
  });
});
