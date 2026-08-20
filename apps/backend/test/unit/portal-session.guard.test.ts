import { ExecutionContext } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { PortalSessionGuard } from "../../src/auth/guards/portal-session.guard";
import { PortalAuthService } from "../../src/auth/core/portal-auth.service";
import { RequestContextResolver } from "../../src/auth/request-context-resolver.service";
import { AuthContextRepository, AuthContextRow } from "../../src/auth/auth-context.repository";

describe("PortalSessionGuard", () => {
  test("resolves only the cookie and session namespace selected by the portal header", async () => {
    const resolveSession = vi.fn().mockResolvedValue({
      id: "session-1",
      portal_type: "TENANT",
      user_id: "user-1",
      tenant_id: "tenant-1",
      credential_id: "credential-1",
      expires_at: new Date("2026-08-13T10:00:00.000Z"),
      idle_expires_at: new Date("2026-08-13T09:00:00.000Z"),
    });
    const request = { id: "request-1", headers: { "x-portal": "admin", cookie: "tenant_session=opaque-tenant-token; sa_session=wrong-token" } };
    const guard = new PortalSessionGuard({ resolveSession } as unknown as PortalAuthService);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(resolveSession).toHaveBeenCalledWith("TENANT", "opaque-tenant-token");
    expect(request).toMatchObject({
      verifiedAuthUser: { authUserId: "user-1", sessionId: "session-1", portalType: "TENANT", tenantId: "tenant-1" },
    });
  });

  test("rejects a request that does not identify a portal session", async () => {
    const guard = new PortalSessionGuard({ resolveSession: vi.fn() } as unknown as PortalAuthService);
    await expect(guard.canActivate(contextFor({ id: "request-2", headers: {} }))).rejects.toMatchObject({ status: 401 });
  });
});

test("resolves a manager employee credential with both required employee and manager roles", async () => {
  const row: AuthContextRow = {
    user_id: "user-1",
    user_email: "manager@example.com",
    user_display_name: "Manager",
    user_status: "active",
    tenant_id: "tenant-1",
    tenant_code: "TENANT-1",
    tenant_display_name: "Tenant One",
    tenant_status: "active",
    membership_id: "membership-1",
    membership_status: "active",
    membership_display_name: "Manager",
    membership_timezone: "Asia/Kolkata",
    role_codes: ["EMPLOYEE", "MANAGER"],
    permission_codes: ["task.read.assigned", "task.create"],
  };
  const resolver = new RequestContextResolver({ findByApplicationUserId: vi.fn().mockResolvedValue([row]) } as unknown as AuthContextRepository);

  const resolved = await resolver.resolve(
    { authUserId: "user-1", sessionId: "session-1", portalType: "EMPLOYEE", issuer: "portal-session", audience: ["portal-session"], expiresAt: new Date("2026-08-13T10:00:00.000Z") },
    { portal: "employee" },
    "request-3",
  );

  expect(resolved.context.roles).toEqual(["EMPLOYEE", "MANAGER"]);
});

function contextFor(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
