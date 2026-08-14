import { expect, test, vi } from "vitest";
import { PortalAuthRepository } from "../../src/auth/core/portal-auth.repository";

test("records a manager logout in both the auth and Super Admin audit trails", async () => {
  const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
  const client = {
    query: vi.fn(async (text: string, values?: readonly unknown[]) => {
      queries.push({ text, values });
      if (text.includes("update authn.sessions s")) {
        return {
          rows: [{
            id: "00000000-0000-4000-8000-000000000001",
            portal_type: "EMPLOYEE",
            user_id: "00000000-0000-4000-8000-000000000002",
            tenant_id: "00000000-0000-4000-8000-000000000003",
            credential_id: "00000000-0000-4000-8000-000000000004",
            email_normalized: "manager@example.com",
          }],
        };
      }
      if (text.includes("r.code = 'MANAGER'")) return { rows: [{ is_manager: true }] };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const repository = new PortalAuthRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

  await repository.revokeSession("EMPLOYEE", "token-hash", {
    ipAddress: "203.0.113.10",
    userAgent: "test-agent",
    requestId: "request-1",
  });

  expect(queries.some(({ text }) => text.includes("insert into authn.login_audit_events"))).toBe(true);
  const platformAudit = queries.find(({ text }) => text.includes("audit.write_portal_session_audit_event"));
  expect(platformAudit?.values).toContain("MANAGER_LOGGED_OUT");
  expect(platformAudit?.values).toContain("203.0.113.10");
  expect(client.release).toHaveBeenCalledOnce();
});
