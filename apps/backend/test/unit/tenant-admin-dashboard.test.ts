import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { RequestContext } from "../../src/auth/request-context";
import { tenantAdminDashboardQuerySchema } from "../../src/platform/tenant-admin-dashboard.dto";
import {
  resolveClientDashboardPeriod,
  resolveTenantDashboardPeriod,
} from "../../src/platform/tenant-admin-dashboard.period";
import { TenantAdminDashboardService } from "../../src/platform/tenant-admin-dashboard.service";
import type { DashboardMetricsResult } from "../../src/platform/tenant-admin-dashboard.repository";
import { TenantAdminDashboardRepository } from "../../src/platform/tenant-admin-dashboard.repository";
import type { TenantAdminRequestContext } from "../../src/platform/tenant-admin-context";

const period = { from: "2026-04-01", to: "2027-03-31", source: "financial_year" as const };

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
        period,
        financialYear: { id: "fy-1", label: "FY 2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31" },
        metrics: {
          activeClients: 5,
          totalSalesAmount: "125000.00",
          collectedAmount: "100000.00",
          outstandingAmount: "25000.00",
          currencyCode: "INR",
          openTasks: 12,
        },
        recentActivity: [
          {
            id: "activity-1",
            action: "TASK_CREATED",
            label: "created a task",
            resourceType: "task",
            resourceId: "task-1",
            result: "success",
            metadata: { priority: "high" },
            actor: "Priya Nair",
            createdAt: new Date("2026-08-05T10:00:00Z"),
          },
        ],
        organisationSetup: {
          tenantProfileComplete: true,
          financialYearComplete: true,
          managerComplete: false,
          employeesComplete: true,
          clientsComplete: true,
          servicesComplete: true,
          workGroupsComplete: false,
          deliveryRulesComplete: true,
        },
        upcomingDeadlines: [
          {
            id: "task-1",
            taskId: "task-1",
            taskTitle: "GST Return Filing",
            clientId: "client-1",
            clientName: "ABC Pvt Ltd",
            dueAt: new Date("2026-08-08T11:30:00Z"),
            priority: "high",
            status: "in_progress",
            workGroupName: "Tax Team",
            assigneeCount: 3,
          },
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
    expect(result.period).toEqual(period);
    expect(result.financialYear?.label).toBe("FY 2026-27");
    expect(result.financialDataAvailable).toBe(true);
    expect(result.financialDataUnavailableReason).toBeNull();
    expect(result.metrics.totalSales).toEqual({ amount: "125000.00", currencyCode: "INR" });
    expect(result.metrics.outstanding).toEqual({ amount: "25000.00", currencyCode: "INR" });
    expect(result.metrics.activeClients).toBe(5);
    expect(result.recentActivity[0]).toMatchObject({
      id: "activity-1",
      action: "TASK_CREATED",
      label: "created a task",
      resourceType: "task",
      resourceId: "task-1",
      result: "success",
      metadata: { priority: "high" },
    });
    expect(result.organisationSetup.completed).toBe(5);
    expect(result.organisationSetup.total).toBe(6);
    expect(result.organisationSetup.items.find((item) => item.key === "FINANCIAL_YEAR")?.destination).toBeNull();
    expect(result.upcomingDeadlines[0]).toMatchObject({
      taskId: "task-1",
      taskTitle: "GST Return Filing",
      clientName: "ABC Pvt Ltd",
      dueAt: "2026-08-08T11:30:00.000Z",
      workGroupName: "Tax Team",
      assigneeCount: 3,
    });
  });

  it("handles missing current financial year without fake zeroes or fallback", async () => {
    const repository = {
      getDashboardData: vi.fn().mockResolvedValue({
        tenant: { id: "tenant-2", name: "Stark Industries", currencyCode: "USD" },
        period: { from: "2026-07-18", to: "2026-08-16", source: "last_30_days" },
        financialYear: null,
        metrics: {
          activeClients: 3,
          totalSalesAmount: "0.00",
          collectedAmount: "0.00",
          outstandingAmount: "0.00",
          currencyCode: "USD",
          openTasks: 8,
        },
        recentActivity: [],
        organisationSetup: {
          tenantProfileComplete: true,
          financialYearComplete: false,
          managerComplete: false,
          employeesComplete: false,
          clientsComplete: true,
          servicesComplete: false,
          workGroupsComplete: false,
          deliveryRulesComplete: false,
        },
        upcomingDeadlines: [],
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
    expect(result.period).toEqual({ from: "2026-07-18", to: "2026-08-16", source: "last_30_days" });
    expect(result.financialDataAvailable).toBe(false);
    expect(result.financialDataUnavailableReason).toBe("CURRENT_FINANCIAL_YEAR_NOT_CONFIGURED");
    expect(result.metrics.totalSales).toEqual({ amount: "0.00", currencyCode: "USD" });
    expect(result.metrics.outstanding).toEqual({ amount: "0.00", currencyCode: "USD" });
    expect(result.metrics.activeClients).toBe(3);
    expect(result.metrics.openTasks).toBe(8);
  });

  it("calculates period metrics from issued invoices without requiring unimplemented credit note tables", async () => {
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
          period: { from: string; to: string; source: "query" | "financial_year" | "last_30_days" },
          currencyCode: string,
          timezone: string,
        ): Promise<DashboardMetricsResult>;
      }
    ).getMetrics.bind(repository);

    const result = await getMetrics(client, "tenant-1", period, "INR", "Asia/Kolkata");

    expect(queries.join("\n")).not.toContain("public.credit_notes");
    expect(queries.join("\n")).not.toContain("sla_status");
    expect(queries.join("\n")).toContain("i.tenant_id = $1");
    expect(queries.join("\n")).toContain("i.issued_on between $2::date and $3::date");
    expect(queries.join("\n")).toContain("t.tenant_id = $1");
    expect(queries.join("\n")).not.toContain("i.financial_year_id = $2");
    expect(result.totalSalesAmount).toBe("1000.00");
    expect(result.collectedAmount).toBe("400.00");
    expect(result.outstandingAmount).toBe("600.00");
  });

  it("reads traceable recent activity without login events", async () => {
    type ActivityClient = {
      query(sqlText: string, params: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };

    const queries: string[] = [];
    const params: unknown[][] = [];
    const client: ActivityClient = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        params.push([...values]);
        return {
          rows: [
            {
              id: "activity-1",
              action: "TASK_CREATED",
              resource_type: "task",
              resource_id: "task-1",
              result: "succeeded",
              metadata: { priority: "high" },
              actor: "System",
              created_at: new Date("2026-08-05T10:00:00Z"),
            },
          ],
        };
      }),
    };
    const repository = new TenantAdminDashboardRepository(null);
    const getRecentActivity = (
      repository as unknown as {
        getRecentActivity(
          client: ActivityClient,
          tenantId: string,
          period: { from: string; to: string; source: "query" | "financial_year" | "last_30_days" },
          timezone: string,
        ): Promise<unknown[]>;
      }
    ).getRecentActivity.bind(repository);

    const result = await getRecentActivity(client, "tenant-1", period, "Asia/Kolkata");

    expect(queries.join("\n")).toContain("ae.tenant_id = $1");
    expect(queries.join("\n")).toContain("ae.result = 'succeeded'");
    expect(queries.join("\n")).toContain("ae.action <> 'TENANT_ADMIN_LOGGED_IN'");
    expect(queries.join("\n")).toContain("(ae.created_at at time zone $4)::date between $2::date and $3::date");
    expect(queries.join("\n")).toContain("limit 8");
    expect(params[0]).toEqual(["tenant-1", period.from, period.to, "Asia/Kolkata"]);
    expect(result[0]).toMatchObject({ id: "activity-1", resourceType: "task", resourceId: "task-1" });
  });

  it("loads only tenant-scoped upcoming task deadlines", async () => {
    type DeadlineClient = {
      query(sqlText: string, params: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };

    const queries: string[] = [];
    const params: unknown[][] = [];
    const client: DeadlineClient = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        params.push([...values]);
        return {
          rows: [
            {
              id: "task-1",
              task_id: "task-1",
              task_title: "GST Return Filing",
              client_id: "client-1",
              client_name: "ABC Pvt Ltd",
              priority: "high",
              status: "in_progress",
              planned_due_at: new Date("2026-08-08T11:30:00Z"),
              work_group_name: "Tax Team",
              assigned_employee_count: 3,
            },
          ],
        };
      }),
    };
    const repository = new TenantAdminDashboardRepository(null);
    const getUpcomingDeadlines = (
      repository as unknown as {
        getUpcomingDeadlines(
          client: DeadlineClient,
          tenantId: string,
          period: { from: string; to: string; source: "query" | "financial_year" | "last_30_days" },
          timezone: string,
        ): Promise<unknown[]>;
      }
    ).getUpcomingDeadlines.bind(repository);

    const result = await getUpcomingDeadlines(client, "tenant-1", period, "Asia/Kolkata");

    expect(queries.join("\n")).toContain("where t.tenant_id = $1");
    expect(queries.join("\n")).toContain("t.status not in ('completed', 'cancelled')");
    expect(queries.join("\n")).toContain("(t.planned_due_at at time zone $4)::date between $2::date and $3::date");
    expect(queries.join("\n")).not.toContain("now() + interval '14 days'");
    expect(queries.join("\n")).toContain("c.tenant_id = t.tenant_id");
    expect(params[0]).toEqual(["tenant-1", period.from, period.to, "Asia/Kolkata"]);
    expect(result[0]).toMatchObject({ taskTitle: "GST Return Filing", clientName: "ABC Pvt Ltd", assigneeCount: 3 });
  });

  it("records the previous and new tenant profile names only when the name changes", async () => {
    const queries: Array<{ sql: string; values: readonly unknown[] | undefined }> = [];
    const profileRows = [
      {
        id: "tenant-1",
        name: "Northstar Advisory",
        previous_name: "Northstar Consulting",
        currency_code: "INR",
        timezone: "Asia/Kolkata",
      },
      {
        id: "tenant-1",
        name: "Northstar Advisory",
        previous_name: "Northstar Advisory",
        currency_code: "INR",
        timezone: "Asia/Kolkata",
      },
    ];
    const client = {
      query: vi.fn(async (sql: string, values?: readonly unknown[]) => {
        queries.push({ sql, values });
        if (sql.includes("update public.tenants")) {
          return {
            rows: [profileRows.shift()],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const repository = new TenantAdminDashboardRepository(pool);
    const context: TenantAdminRequestContext = {
      userId: "user-1",
      authUserId: "auth-user-1",
      tenantId: "tenant-1",
      membershipId: "membership-1",
      isPlatformAdmin: false,
      roles: ["TENANT_ADMIN"],
      permissions: ["tenant.update"],
      requestId: "request-1",
    };

    await expect(repository.updateTenantProfile(context, "Northstar Advisory")).resolves.toMatchObject({
      name: "Northstar Advisory",
    });

    const audit = queries.find(({ sql }) => sql.includes("audit.write_audit_event"));
    expect(audit?.sql).toContain("TENANT_PROFILE_NAME_CHANGED");
    expect(audit?.values).toEqual([
      "tenant-1",
      JSON.stringify({ previousName: "Northstar Consulting", updatedName: "Northstar Advisory" }),
    ]);

    queries.length = 0;
    await repository.updateTenantProfile(context, "Northstar Advisory");
    expect(queries.some(({ sql }) => sql.includes("audit.write_audit_event"))).toBe(false);
  });
});

describe("tenant dashboard date range", () => {
  it("defaults to the current financial year, otherwise the last 30 days", () => {
    expect(
      resolveTenantDashboardPeriod({
        financialYear: { startsOn: "2026-04-01", endsOn: "2027-03-31" },
        today: "2026-08-16",
      }),
    ).toEqual({ from: "2026-04-01", to: "2027-03-31", source: "financial_year" });

    expect(
      resolveTenantDashboardPeriod({
        financialYear: null,
        today: "2026-08-16",
      }),
    ).toEqual({ from: "2026-07-18", to: "2026-08-16", source: "last_30_days" });
  });

  it("lets an explicit query range override the financial year", () => {
    expect(
      resolveTenantDashboardPeriod({
        from: "2026-08-01",
        to: "2026-08-16",
        financialYear: { startsOn: "2026-04-01", endsOn: "2027-03-31" },
        today: "2026-08-16",
      }),
    ).toEqual({ from: "2026-08-01", to: "2026-08-16", source: "query" });
  });

  it("rejects inverted, incomplete, and oversized dashboard date ranges", () => {
    expect(tenantAdminDashboardQuerySchema.safeParse({}).success).toBe(true);
    expect(tenantAdminDashboardQuerySchema.safeParse({ from: "2026-08-01" }).success).toBe(false);
    expect(tenantAdminDashboardQuerySchema.safeParse({ from: "2026-08-16", to: "2026-08-01" }).success).toBe(false);
    expect(tenantAdminDashboardQuerySchema.safeParse({ from: "2026-08-01", to: "2026-08-16" }).success).toBe(true);
    expect(tenantAdminDashboardQuerySchema.safeParse({ from: "2020-01-01", to: "2023-01-02" }).success).toBe(false);
    expect(tenantAdminDashboardQuerySchema.safeParse({ from: "2014-12-31", to: "2015-01-31" }).success).toBe(false);
  });
});

describe("client dashboard date range", () => {
  it("defaults to the current month through the next year so future installments stay visible", () => {
    expect(
      resolveClientDashboardPeriod({
        today: "2026-08-17",
      }),
    ).toEqual({ from: "2026-08-01", to: "2027-08-18", source: "upcoming_year" });
  });

  it("lets an explicit query range override the default upcoming year", () => {
    expect(
      resolveClientDashboardPeriod({
        from: "2026-09-01",
        to: "2026-09-30",
        today: "2026-08-17",
      }),
    ).toEqual({ from: "2026-09-01", to: "2026-09-30", source: "query" });
  });
});
