import { describe, expect, it, vi } from "vitest";
import { RequestContext } from "../../src/auth/request-context";
import { AppConfig } from "../../src/config/app-config";
import {
  createTenantAdminTaskSchema,
  decideTenantAdminTaskApprovalSchema,
  updateTenantAdminEmployeeAssignmentSchema,
} from "../../src/platform/tenant-admin-tasks.dto";
import { TenantAdminTasksRepository } from "../../src/platform/tenant-admin-tasks.repository";
import { TenantAdminTasksService } from "../../src/platform/tenant-admin-tasks.service";

describe("TenantAdminTasksService", () => {
  it("requires actionable remarks when a Tenant Admin returns a task", () => {
    expect(() =>
      decideTenantAdminTaskApprovalSchema.parse({ decision: "return", remarks: "" }),
    ).toThrow("Enter the changes required before returning this task.");
    expect(
      decideTenantAdminTaskApprovalSchema.parse({
        decision: "return",
        remarks: "Correct the GST amount and attach the revised worksheet.",
      }),
    ).toMatchObject({ decision: "return" });
  });

  it("accepts only UUID work group IDs in employee assignment requests", () => {
    expect(
      updateTenantAdminEmployeeAssignmentSchema.parse({
        workGroupIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    ).toMatchObject({ workGroupIds: ["11111111-1111-4111-8111-111111111111"] });
    expect(() => updateTenantAdminEmployeeAssignmentSchema.parse({ workGroupIds: ["not-a-uuid"] })).toThrow();
  });

  it("requires at least one employee when creating a tenant admin task", () => {
    expect(() =>
      createTenantAdminTaskSchema.parse({
        clientId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        title: "GST return filing",
        employeeIds: [],
        billing: {
          rateSource: "existing",
          rateCardItemId: "33333333-3333-4333-8333-333333333333",
          quantity: 1,
        },
      }),
    ).toThrow();
  });

  it("rejects platform admin and incomplete tenant contexts before querying", async () => {
    const repository = {
      getOptions: vi.fn(),
      listTasks: vi.fn(),
      createTask: vi.fn(),
      decideTaskApproval: vi.fn(),
    } as unknown as TenantAdminTasksRepository;
    const config = {
      supabaseUrl: undefined,
      supabaseAdminKey: undefined,
    } as AppConfig;
    const service = new TenantAdminTasksService(repository, config);

    const deniedContexts: RequestContext[] = [
      {
        userId: "user-1",
        authUserId: "auth-user-1",
        isPlatformAdmin: true,
        roles: ["SUPER_ADMIN"],
        permissions: ["task.create"],
        requestId: "req-1",
      },
      {
        userId: "user-2",
        authUserId: "auth-user-2",
        tenantId: "tenant-1",
        isPlatformAdmin: false,
        roles: ["TENANT_ADMIN"],
        permissions: ["task.create"],
        requestId: "req-2",
      },
      {
        userId: "user-3",
        authUserId: "auth-user-3",
        tenantId: "tenant-1",
        membershipId: "member-1",
        isPlatformAdmin: false,
        roles: ["EMPLOYEE"],
        permissions: ["task.create"],
        requestId: "req-3",
      },
    ];

    for (const context of deniedContexts) {
      await expect(service.getOptions(context)).rejects.toThrow(
        "Selected portal is not available for this membership.",
      );
    }
    expect(repository.getOptions).not.toHaveBeenCalled();
    await expect(
      service.decideTaskApproval(deniedContexts[0]!, "11111111-1111-4111-8111-111111111111", { decision: "approve", remarks: "" }),
    ).rejects.toThrow("Selected portal is not available for this membership.");
    expect(repository.decideTaskApproval).not.toHaveBeenCalled();
  });
});

describe("TenantAdminTasksRepository", () => {
  it("does not remove an employee from a work group they manage", async () => {
    type QueryClient = {
      query(sqlText: string): Promise<{ rows: Array<Record<string, unknown>> }>;
    };
    const client: QueryClient = {
      query: vi.fn(async (sqlText: string) => {
        if (sqlText.includes("from public.work_group_memberships")) {
          return { rows: [{ work_group_id: "11111111-1111-4111-8111-111111111111" }] };
        }
        return { rows: [] };
      }),
    };
    const repository = new TenantAdminTasksRepository(null);
    const replaceEmployeeWorkGroupMemberships = (
      repository as unknown as {
        replaceEmployeeWorkGroupMemberships(
          client: QueryClient,
          context: { tenantId: string; membershipId: string },
          employeeId: string,
          workGroupIds: readonly string[],
        ): Promise<void>;
      }
    ).replaceEmployeeWorkGroupMemberships.bind(repository);

    await expect(
      replaceEmployeeWorkGroupMemberships(
        client,
        { tenantId: "tenant-1", membershipId: "membership-1" },
        "employee-1",
        [],
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "WORK_GROUP_MANAGER_REQUIRED" }) });
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("lists tasks through tenant-scoped joins only", async () => {
    type QueryClient = {
      query(sqlText: string, params: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };

    const queries: string[] = [];
    const params: unknown[][] = [];
    const client: QueryClient = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        params.push([...values]);
        return {
          rows: [
            {
              id: "task-1",
              title: "GST Return Filing",
              description: null,
              client_id: "client-1",
              client_name: "ABC Pvt Ltd",
              service_id: "service-1",
              service_name: "GST Filing",
              work_group_id: "group-1",
              work_group_name: "Tax Team",
              priority: "high",
              status: "assigned",
              sla_status: "not_started",
              planned_due_at: new Date("2026-08-08T11:30:00Z"),
              assignee_count: 1,
              assignees: [{ id: "employee-1", name: "Priya Sen" }],
            },
          ],
        };
      }),
    };
    const repository = new TenantAdminTasksRepository(null);
    const getTasks = (
      repository as unknown as {
        getTasks(client: QueryClient, tenantId: string, clientId?: string, taskId?: string): Promise<unknown[]>;
      }
    ).getTasks.bind(repository);

    const result = await getTasks(client, "tenant-1", "client-1");
    const sql = queries.join("\n");

    expect(sql).toContain("where t.tenant_id = $1");
    expect(sql).toContain("c.tenant_id = t.tenant_id");
    expect(sql).toContain("s.tenant_id = t.tenant_id");
    expect(sql).toContain("wg.tenant_id = t.tenant_id");
    expect(sql).toContain("ta.tenant_id = t.tenant_id");
    expect(sql).toContain("e.tenant_id = ta.tenant_id");
    expect(params[0]).toEqual(["tenant-1", "client-1", null]);
    expect(result[0]).toMatchObject({
      id: "task-1",
      clientId: "client-1",
      serviceId: "service-1",
      slaStatus: "not_started",
      assigneeCount: 1,
    });
  });

  it("validates existing task rates against tenant, client, service, and active dates", async () => {
    type QueryClient = {
      query(sqlText: string, params: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };

    const queries: string[] = [];
    const params: unknown[][] = [];
    const client: QueryClient = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        params.push([...values]);
        return { rows: [{ id: "rate-1", rate_amount: "1500.00", currency_code: "INR" }] };
      }),
    };
    const repository = new TenantAdminTasksRepository(null);
    const resolveBillingRate = (
      repository as unknown as {
        resolveBillingRate(
          client: QueryClient,
          context: unknown,
          input: unknown,
          defaultCurrencyCode: string,
        ): Promise<{ rateCardItemId: string; quantity: number; unitRate: number; currencyCode: string }>;
      }
    ).resolveBillingRate.bind(repository);

    const result = await resolveBillingRate(
      client,
      { tenantId: "tenant-1", membershipId: "member-1" },
      {
        clientId: "client-1",
        serviceId: "service-1",
        billing: { rateSource: "existing", rateCardItemId: "rate-1", quantity: 1 },
      },
      "INR",
    );
    const sql = queries.join("\n");

    expect(result).toEqual({
      rateCardItemId: "rate-1",
      quantity: 1,
      unitRate: 1500,
      currencyCode: "INR",
    });
    expect(sql).toContain("rci.tenant_id = $1");
    expect(sql).toContain("rci.service_id = $3");
    expect(sql).toContain("(rc.client_id = $4 or rc.client_id is null)");
    expect(sql).toContain("rci.status = 'active'");
    expect(sql).toContain("rc.status = 'active'");
    expect(sql).toContain("current_date between rc.effective_from");
    expect(params[0]).toEqual(["tenant-1", "rate-1", "service-1", "client-1"]);
  });

  it("keeps a new task charge pending until final Tenant Admin approval", async () => {
    const queries: string[] = [];
    const parameterCounts: number[] = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        parameterCounts.push(values.length);
        return { rows: [] };
      }),
    };
    const repository = new TenantAdminTasksRepository(null);
    const createPendingBillableEntry = (
      repository as unknown as {
        createPendingBillableEntry(
          transactionClient: typeof client,
          tenantId: string,
          taskId: string,
          clientId: string,
          pricing: { rateCardItemId: string; quantity: number; unitRate: number; currencyCode: string },
        ): Promise<void>;
      }
    ).createPendingBillableEntry.bind(repository);

    await createPendingBillableEntry(
      client,
      "tenant-1",
      "task-1",
      "client-1",
      { rateCardItemId: "rate-1", quantity: 1, unitRate: 1500, currencyCode: "INR" },
    );

    expect(queries.join("\n")).toContain("'pending_review', null, null");
    expect(parameterCounts).toEqual([12]);
  });

  it("promotes only a tenant-scoped pending charge when final approval succeeds", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sqlText: string) => {
        queries.push(sqlText);
        if (sqlText.includes("from public.tasks t")) {
          return { rows: [{ id: "submission-1", employee_id: "employee-1" }] };
        }
        if (sqlText.includes("update public.billable_task_entries")) {
          return { rows: [{ id: "entry-1" }] };
        }
        return { rows: [] };
      }),
    };
    const repository = new TenantAdminTasksRepository(null);
    const repositoryForTest = repository as unknown as {
      withContext(context: unknown, work: (transactionClient: typeof client) => Promise<unknown>): Promise<unknown>;
      getTasks(): Promise<unknown[]>;
    };
    repositoryForTest.withContext = async (_context, work) => work(client);
    repositoryForTest.getTasks = async () => [{ id: "task-1" }];

    await repository.decideTaskApproval(
      { tenantId: "tenant-1", membershipId: "member-1" } as never,
      "task-1",
      { decision: "approve", remarks: "" },
    );

    const sql = queries.join("\n");
    expect(sql).toContain("t.status = 'tenant_approval'");
    expect(sql).toContain("and status = 'pending_review'");
    expect(sql).toContain("'approved_for_invoice'");
  });

  it("returns the same employee assignment to active rework with Tenant Admin remarks", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[] = []) => {
        calls.push({ sql: sqlText, values });
        if (sqlText.includes("from public.tasks t")) {
          return { rows: [{ id: "submission-1", employee_id: "employee-1" }], rowCount: 1 };
        }
        if (sqlText.includes("insert into public.task_work_sessions")) {
          return { rows: [{ id: "session-1" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const repository = new TenantAdminTasksRepository(null);
    const repositoryForTest = repository as unknown as {
      withContext(context: unknown, work: (transactionClient: typeof client) => Promise<unknown>): Promise<unknown>;
      getTasks(): Promise<Array<{ id: string; title: string }>>;
    };
    repositoryForTest.withContext = async (_context, work) => work(client);
    repositoryForTest.getTasks = async () => [{ id: "task-1", title: "GST filing" }];

    await repository.decideTaskApproval(
      { tenantId: "tenant-1", membershipId: "member-1", userId: "user-1" } as never,
      "task-1",
      {
        decision: "return",
        remarks: "Correct the GST amount and attach the revised worksheet.",
      },
    );

    expect(
      calls.find((call) => call.sql.includes("update public.task_assignments"))?.values,
    ).toEqual(["tenant-1", "task-1", "employee-1", "active"]);
    expect(
      calls.find((call) => call.sql.includes("update public.task_submissions"))?.values,
    ).toEqual([
      "tenant-1",
      "submission-1",
      "returned",
      "Correct the GST amount and attach the revised worksheet.",
    ]);
    expect(
      calls.find((call) => call.sql.includes("update public.tasks") && call.sql.includes("billable_status"))?.values,
    ).toEqual(["tenant-1", "task-1", "in_progress", "pending_completion", "member-1"]);
    expect(
      calls.find((call) => call.sql.includes("insert into public.notifications"))?.values,
    ).toContain("task-returned-by-tenant:submission-1");
  });
});
