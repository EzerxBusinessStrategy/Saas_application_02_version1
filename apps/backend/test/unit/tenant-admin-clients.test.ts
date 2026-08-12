import { describe, expect, it, vi } from "vitest";
import { TenantAdminClientsRepository } from "../../src/platform/tenant-admin-clients.repository";

describe("TenantAdminClientsRepository", () => {
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
        if (sqlText.includes("insert into public.client_portal_accounts")) return { rows: [], rowCount: 1 };
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
    expect(sql).toContain("CLIENT_PORTAL_ACCOUNT_CREATED");
    expect(sql).toContain("CLIENT_CREATED");
    expect(params).toContainEqual(["tenant-1", "cl-101", "ABC Pvt Ltd", "ABC Pvt Ltd"]);
  });
});
