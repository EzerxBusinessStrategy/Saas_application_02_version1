import { describe, expect, it, vi } from "vitest";
import { RequestContext } from "../../src/auth/request-context";
import { TenantAdminDashboardService } from "../../src/platform/tenant-admin-dashboard.service";
import type { DashboardMetricsResult } from "../../src/platform/tenant-admin-dashboard.repository";
import { TenantAdminDashboardRepository } from "../../src/platform/tenant-admin-dashboard.repository";

describe("TenantAdminDashboardService", () => {
  it("rejects platform admin and incomplete tenant contexts before querying", async () => {
    const repository = { getDashboardData: vi.fn() } as unknown as TenantAdminDashboardRepository;
    const service = new TenantAdminDashboardService(repository);

    const deniedContexts: RequestContext[] = [
      {
        userId: "user-1",
        authUserId: "auth-user-1",
        isPlatformAdmin: true,
        roles: ["SUPER_ADMIN"],
        permissions: [],
        requestId: "req-1",
      },
      {
        userId: "user-2",
        authUserId: "auth-user-2",
        tenantId: "tenant-1",
        isPlatformAdmin: false,
        roles: ["TENANT_ADMIN"],
        permissions: ["tenant.read"],
        requestId: "req-2",
      },
      {
        userId: "user-3",
        authUserId: "auth-user-3",
        tenantId: "tenant-1",
        membershipId: "member-1",
        isPlatformAdmin: false,
        roles: ["EMPLOYEE"],
        permissions: ["tenant.read"],
        requestId: "req-3",
      },
    ];

    for (const context of deniedContexts) {
      await expect(service.getDashboard(context)).rejects.toThrow(
        "Selected portal is not available for this membership.",
      );
    }
    expect(repository.getDashboardData).not.toHaveBeenCalled();
  });

  it("automatically uses current active financial year and formats dashboard metrics", async () => {
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
        },
        recentActivity: [
          { action: "Created tenant invoice", actor: "Priya Nair", createdAt: new Date("2026-08-05T10:00:00Z") },
        ],
      }),
    } as unknown as TenantAdminDashboardRepository;

    const service = new TenantAdminDashboardService(repository);

    const tenantAdminContext: RequestContext = {
      userId: "user-2",
      authUserId: "auth-user-2",
      tenantId: "tenant-1",
      membershipId: "member-1",
      isPlatformAdmin: false,
      roles: ["TENANT_ADMIN"],
      permissions: ["tenant.read"],
      requestId: "req-2",
    };

    const result = await service.getDashboard(tenantAdminContext);

    expect(result.tenant).toEqual({ id: "tenant-1", name: "Acme Corp", currencyCode: "INR" });
    expect(result.financialYear?.label).toBe("FY 2026-27");
    expect(result.financialDataAvailable).toBe(true);
    expect(result.financialDataUnavailableReason).toBeNull();
    expect(result.metrics.totalSales).toEqual({ amount: "125000.00", currencyCode: "INR" });
    expect(result.metrics.outstanding).toEqual({ amount: "25000.00", currencyCode: "INR" });
    expect(result.metrics.activeClients).toBe(5);
  });

  it("handles missing current financial year without fake zeroes or fallback", async () => {
    const repository = {
      getDashboardData: vi.fn().mockResolvedValue({
        tenant: { id: "tenant-2", name: "Stark Industries", currencyCode: "USD" },
        financialYear: null,
        metrics: {
          activeClients: 3,
          totalSalesAmount: null,
          collectedAmount: null,
          outstandingAmount: null,
          currencyCode: "USD",
          openTasks: 8,
          overdueTasks: 0,
        },
        recentActivity: [],
      }),
    } as unknown as TenantAdminDashboardRepository;

    const service = new TenantAdminDashboardService(repository);

    const tenantAdminContext: RequestContext = {
      userId: "user-3",
      authUserId: "auth-user-3",
      tenantId: "tenant-2",
      membershipId: "member-2",
      isPlatformAdmin: false,
      roles: ["TENANT_ADMIN"],
      permissions: ["tenant.read"],
      requestId: "req-3",
    };

    const result = await service.getDashboard(tenantAdminContext);

    expect(result.financialYear).toBeNull();
    expect(result.financialDataAvailable).toBe(false);
    expect(result.financialDataUnavailableReason).toBe("CURRENT_FINANCIAL_YEAR_NOT_CONFIGURED");
    expect(result.metrics.totalSales).toBeNull();
    expect(result.metrics.outstanding).toBeNull();
    expect(result.metrics.activeClients).toBe(3);
    expect(result.metrics.openTasks).toBe(8);
  });

  it("calculates financial-year metrics without requiring unimplemented credit note tables", async () => {
    type MetricsClient = {
      query(sqlText: string): Promise<{ rows: Array<Record<string, unknown>> }>;
    };

    const queries: string[] = [];
    const client: MetricsClient = {
      query: vi.fn(async (sqlText: string) => {
        queries.push(sqlText);
        if (sqlText.includes("public.credit_notes")) {
          throw new Error("credit_notes table does not exist");
        }

        return {
          rows: [
            {
              active_clients: 2,
              total_sales: "1000.00",
              collected: "400.00",
              open_tasks: 3,
              overdue_tasks: 1,
            },
          ],
        };
      }),
    };
    const repository = new TenantAdminDashboardRepository(null);
    const getMetrics = (
      repository as unknown as {
        getMetrics(
          client: MetricsClient,
          tenantId: string,
          financialYearId: string | undefined,
          currencyCode: string,
        ): Promise<DashboardMetricsResult>;
      }
    ).getMetrics.bind(repository);

    const result = await getMetrics(client, "tenant-1", "fy-1", "INR");

    expect(queries.join("\n")).not.toContain("public.credit_notes");
    expect(queries.join("\n")).not.toContain("sla_status");
    expect(result.totalSalesAmount).toBe("1000.00");
    expect(result.collectedAmount).toBe("400.00");
    expect(result.outstandingAmount).toBe("600.00");
  });
});
