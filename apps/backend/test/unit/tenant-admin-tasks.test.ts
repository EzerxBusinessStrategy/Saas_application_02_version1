import { describe, expect, it, vi } from "vitest";
import { RequestContext } from "../../src/auth/request-context";
import { TenantAdminTasksRepository } from "../../src/platform/tenant-admin-tasks.repository";
import { TenantAdminTasksService } from "../../src/platform/tenant-admin-tasks.service";

describe("TenantAdminTasksService", () => {
  it("rejects platform admin and incomplete tenant contexts before querying", async () => {
    const repository = {
      getOptions: vi.fn(),
      listTasks: vi.fn(),
      createTask: vi.fn(),
    } as unknown as TenantAdminTasksRepository;
    const service = new TenantAdminTasksService(repository);

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
  });
});

describe("TenantAdminTasksRepository", () => {
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
});
