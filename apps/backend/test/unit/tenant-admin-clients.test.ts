import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TenantAdminClientsRepository } from "../../src/platform/tenant-admin-clients.repository";

describe("TenantAdminClientsRepository", () => {
  it("loads client work groups from the live tenant and client relationship", async () => {
    const queries: string[] = [];
    type QueryClient = {
      query(sqlText: string, values: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };
    const client: QueryClient = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        expect(values).toEqual(["tenant-1", "client-1"]);
        return { rows: [{ id: "group-1", name: "Tax Team" }] };
      }),
    };
    const repository = new TenantAdminClientsRepository(null);
    const getWorkGroups = (
      repository as unknown as {
        getWorkGroups(client: QueryClient, tenantId: string, clientId: string): Promise<unknown[]>;
      }
    ).getWorkGroups.bind(repository);

    await expect(getWorkGroups(client, "tenant-1", "client-1")).resolves.toEqual([
      { id: "group-1", name: "Tax Team" },
    ]);
    const sql = queries.join("\n");
    expect(sql).toContain("where wg.tenant_id = $1 and wg.client_id = $2");
    expect(sql).toContain("e.tenant_id = wg.tenant_id");
  });

  it("loads client tasks with active assignee names and tenant-scoped assignments", async () => {
    const queries: string[] = [];
    type QueryClient = {
      query(sqlText: string, values: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };
    const client: QueryClient = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        expect(values).toEqual(["tenant-1", "client-1"]);
        return {
          rows: [
            {
              id: "task-1",
              title: "demo (2027-03)",
              status: "assigned",
              priority: "normal",
              plannedDueAt: new Date("2027-03-11T00:00:00.000Z"),
              assignees: [{ id: "emp-1", name: "Priya Sen" }],
            },
          ],
        };
      }),
    };
    const repository = new TenantAdminClientsRepository(null);
    const getTasks = (
      repository as unknown as {
        getTasks(client: QueryClient, tenantId: string, clientId: string): Promise<unknown[]>;
      }
    ).getTasks.bind(repository);

    await expect(getTasks(client, "tenant-1", "client-1")).resolves.toEqual([
      {
        id: "task-1",
        title: "demo (2027-03)",
        status: "assigned",
        priority: "normal",
        plannedDueAt: "2027-03-11T00:00:00.000Z",
        assigneeName: "Priya Sen",
      },
    ]);
    const sql = queries.join("\n");
    expect(sql).toContain("where t.tenant_id = $1 and t.client_id = $2");
    expect(sql).toContain("public.task_assignments ta");
    expect(sql).toContain("ta.tenant_id = t.tenant_id");
    expect(sql).toContain("ta.status = 'active'");
  });

  it("creates a tenant-scoped client with a lowercase generated code when the client ID is empty", async () => {
    const queries: string[] = [];
    const params: unknown[][] = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[] = []) => {
        queries.push(sqlText);
        params.push([...values]);
        if (sqlText.includes("insert into public.clients")) return { rows: [{ id: "client-1" }], rowCount: 1 };
        if (sqlText.includes("insert into public.users")) return { rows: [{ id: "user-client-1" }], rowCount: 1 };
        if (sqlText.includes("insert into public.tenant_memberships")) return { rows: [{ id: "member-client-1" }], rowCount: 1 };
        if (sqlText.includes("insert into public.membership_roles")) return { rows: [{ id: "role-1" }], rowCount: 1 };
        if (sqlText.includes("insert into public.client_portal_accounts")) return { rows: [{ id: "client-account-1" }], rowCount: 1 };
        if (sqlText.includes("with client_base")) {
          return {
            rows: [{
              id: "client-1",
              name: "ABC Pvt Ltd",
              code: "abc-pvt",
              currency_code: "INR",
              primary_contact_name: "Priya Sen",
              primary_contact_email: "priya@example.com",
              active_services: 0,
              services: [],
              managers: [],
              revenue_amount: "0",
              outstanding_amount: "0",
              upcoming_deadline: null,
              status: "onboarding",
              created_at: new Date("2026-08-05T00:00:00Z"),
              open_tasks: 0,
              at_risk_tasks: 0,
              onboarding_progress: 35,
              document_progress: 0,
            }],
          };
        }
        if (sqlText.includes("from public.client_contacts")) {
          return {
            rows: [{
              id: "contact-1",
              name: "Priya Sen",
              role: "Accounts",
              email: "priya@example.com",
              phone: "",
              preference: "email",
              status: "active",
              primary: true,
              notes: "",
            }],
          };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new TenantAdminClientsRepository(pool as never);

    await repository.create(
      {
        authUserId: "auth-user-1",
        userId: "user-1",
        tenantId: "tenant-1",
        membershipId: "member-1",
        roles: ["TENANT_ADMIN"],
        permissions: ["client.update"],
        isPlatformAdmin: false,
        requestId: "req-1",
      },
      {
        displayName: "ABC Pvt Ltd",
        legalName: "",
        code: "",
        primaryContact: {
          name: "Priya Sen",
          role: "Accounts",
          email: "priya@example.com",
          phone: "",
        },
        portalAccess: {
          email: "client@example.com",
          phone: "123456",
          password: "Password123",
        },
      },
      "auth-client-1",
    );

    const sql = queries.join("\n");
    expect(sql).toContain("insert into public.clients");
    expect(sql).toContain("insert into public.client_contacts");
    expect(sql).toContain("insert into public.client_portal_accounts");
    expect(sql).toContain("insert into authn.credentials");
    expect(sql).toContain("CLIENT_PORTAL_ACCOUNT_CREATED");
    expect(sql).toContain("CLIENT_CREATED");
    expect(params).toContainEqual(["tenant-1", "cl-101", "ABC Pvt Ltd", "ABC Pvt Ltd"]);
  });

  it("scopes client directory filters to assigned employees and employee-aware search", () => {
    const source = readFileSync(
      resolve(__dirname, "../../src/platform/tenant-admin-clients.repository.ts"),
      "utf8",
    );

    expect(source).toContain("getEmployeeOptions");
    expect(source).toContain("ta.employee_id = $7");
    expect(source).toContain("coalesce(e.employee_code, '') ilike");
  });
});
