import { describe, expect, it, vi } from "vitest";
import { RequestContext } from "../../src/auth/request-context";
import { TenantAdminEmployeePerformanceService } from "../../src/platform/tenant-admin-employee-performance.service";
import { TenantAdminEmployeePerformanceRepository } from "../../src/platform/tenant-admin-employee-performance.repository";

describe("TenantAdminEmployeePerformanceService", () => {
  it("rejects platform admin context before querying employee performance data", async () => {
    const repository = {
      getPerformanceData: vi.fn(),
    } as unknown as TenantAdminEmployeePerformanceRepository;
    const service = new TenantAdminEmployeePerformanceService(repository);

    const platformContext: RequestContext = {
      userId: "user-1",
      authUserId: "auth-user-1",
      isPlatformAdmin: true,
      roles: ["SUPER_ADMIN"],
      permissions: [],
      requestId: "req-1",
    };

    await expect(service.getPerformanceList(platformContext, {})).rejects.toThrow(
      "Selected portal is not available for this membership.",
    );
    expect(repository.getPerformanceData).not.toHaveBeenCalled();
  });

  it("ranks eligible employees using SLA efficiency and completion scores", async () => {
    const repository = {
      getPerformanceData: vi.fn().mockResolvedValue({
        period: { from: "2026-04-01", to: "2027-03-31", label: "FY 2026-27" },
        tenantCurrency: "INR",
        rows: [
          {
            employee_id: "emp-fast",
            employee_code: "EMP-001",
            display_name: "Aarav Sharma",
            role: "Tax Senior",
            employment_status: "active",
            clients_served: 4,
            total_assigned_tasks: 10,
            completed_tasks: 9,
            open_tasks: 1,
            overdue_tasks: 0,
            cancelled_tasks: 0,
            on_time_completed_tasks: 8,
            sla_measured_tasks: 9,
            sla_met_tasks: 8,
            total_actual_sla_minutes: 900,
            total_target_sla_minutes: 1800,
            sla_minutes_array: [90, 100, 110, 100, 95, 105, 100, 100, 100],
            attributed_revenue: 150000,
            currency_code: "INR",
          },
          {
            employee_id: "emp-slow",
            employee_code: "EMP-002",
            display_name: "Rahul Verma",
            role: "Tax Executive",
            employment_status: "active",
            clients_served: 2,
            total_assigned_tasks: 6,
            completed_tasks: 4,
            open_tasks: 2,
            overdue_tasks: 1,
            cancelled_tasks: 0,
            on_time_completed_tasks: 2,
            sla_measured_tasks: 4,
            sla_met_tasks: 2,
            total_actual_sla_minutes: 1200,
            total_target_sla_minutes: 1000,
            sla_minutes_array: [300, 300, 300, 300],
            attributed_revenue: 50000,
            currency_code: "INR",
          },
        ],
      }),
    } as unknown as TenantAdminEmployeePerformanceRepository;

    const service = new TenantAdminEmployeePerformanceService(repository);

    const tenantAdminContext: RequestContext = {
      userId: "user-admin",
      authUserId: "auth-admin",
      tenantId: "tenant-1",
      membershipId: "member-admin",
      isPlatformAdmin: false,
      roles: ["TENANT_ADMIN"],
      permissions: ["employee.read"],
      requestId: "req-2",
    };

    const res = await service.getPerformanceList(tenantAdminContext, {});

    expect(res.items.length).toBe(2);
    const topPerformer = res.items[0];
    const secondPerformer = res.items[1];

    expect(topPerformer.employee.name).toBe("Aarav Sharma");
    expect(topPerformer.rank).toBe(1);
    expect(topPerformer.slaEfficiencyRatio).toBe(0.5);
    expect(topPerformer.averageSlaMinutes).toBe(100);

    expect(secondPerformer.employee.name).toBe("Rahul Verma");
    expect(secondPerformer.rank).toBe(2);
    expect(secondPerformer.slaEfficiencyRatio).toBe(1.2);
    expect(secondPerformer.averageSlaMinutes).toBe(300);

    expect(topPerformer.performanceScore!).toBeGreaterThan(secondPerformer.performanceScore!);
  });

  it("marks employees with fewer than 3 completed tasks as ineligible for top ranking", async () => {
    const repository = {
      getPerformanceData: vi.fn().mockResolvedValue({
        period: { from: "2026-04-01", to: "2027-03-31", label: "FY 2026-27" },
        tenantCurrency: "INR",
        rows: [
          {
            employee_id: "emp-new",
            employee_code: "EMP-003",
            display_name: "New Joiner",
            role: "Associate",
            employment_status: "active",
            clients_served: 1,
            total_assigned_tasks: 2,
            completed_tasks: 1,
            open_tasks: 1,
            overdue_tasks: 0,
            cancelled_tasks: 0,
            on_time_completed_tasks: 1,
            sla_measured_tasks: 1,
            sla_met_tasks: 1,
            total_actual_sla_minutes: 30,
            total_target_sla_minutes: 60,
            sla_minutes_array: [30],
            attributed_revenue: 10000,
            currency_code: "INR",
          },
        ],
      }),
    } as unknown as TenantAdminEmployeePerformanceRepository;

    const service = new TenantAdminEmployeePerformanceService(repository);

    const tenantAdminContext: RequestContext = {
      userId: "user-admin",
      authUserId: "auth-admin",
      tenantId: "tenant-1",
      membershipId: "member-admin",
      isPlatformAdmin: false,
      roles: ["TENANT_ADMIN"],
      permissions: ["employee.read"],
      requestId: "req-3",
    };

    const res = await service.getPerformanceList(tenantAdminContext, {});

    expect(res.items[0].isEligibleForRanking).toBe(false);
    expect(res.items[0].eligibilityReason).toBe("INSUFFICIENT_COMPLETED_TASKS");
    expect(res.items[0].rank).toBeNull();
  });
});
