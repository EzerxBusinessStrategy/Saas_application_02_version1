import { describe, expect, test, vi } from "vitest";
import { PortalAuthService } from "../../src/auth/core/portal-auth.service";
import { PortalAuthRepository } from "../../src/auth/core/portal-auth.repository";
import { OpaqueSessionTokenService } from "../../src/auth/core/opaque-session-token.service";
import { PasswordService } from "../../src/auth/core/password.service";
import { RequestContextResolver } from "../../src/auth/request-context-resolver.service";
import { AuthContextRepository, AuthContextRow } from "../../src/auth/auth-context.repository";

vi.mock("../../src/database/transaction-context", () => ({
  setTrustedDatabaseContext: vi.fn().mockResolvedValue(undefined),
}));

describe("PortalAuthService.switchContext", () => {
  test("creates a tenant session from the existing Super Admin credential", async () => {
    const createSession = vi.fn();
    const repository = {
      withTransaction: async (work: (client: unknown) => Promise<unknown>) => work({}),
      listCurrentUserContexts: vi.fn().mockResolvedValue([
        {
          context_type: "platform",
          tenant_id: null,
          tenant_code: null,
          tenant_name: null,
          membership_id: null,
          display_title: null,
          roles: ["SUPER_ADMIN"],
          has_employee: false,
        },
        {
          context_type: "tenant",
          tenant_id: "11111111-1111-4111-8111-111111111111",
          tenant_code: "abc",
          tenant_name: "ABC",
          membership_id: "22222222-2222-4222-8222-222222222222",
          display_title: "Founder",
          roles: ["TENANT_ADMIN", "MANAGER", "EMPLOYEE"],
          has_employee: true,
        },
      ]),
      findActiveCredentialByUserId: vi.fn().mockResolvedValue({
        id: "credential-1",
        portal_type: "SUPER_ADMIN",
        user_id: "user-1",
        tenant_id: null,
        email_normalized: "owner@example.com",
        password_hash: "hash",
        status: "ACTIVE",
        failed_login_attempts: 0,
        locked_until: null,
        user_status: "active",
        tenant_status: null,
      }),
      createSession,
    };
    const tokens = {
      create: () => "opaque-token",
      hash: () => "hashed-token",
    } as unknown as OpaqueSessionTokenService;
    const service = new PortalAuthService(
      repository as unknown as PortalAuthRepository,
      {} as PasswordService,
      tokens,
    );

    const result = await service.switchContext(
      "user-1",
      { workspace: "admin", tenantId: "11111111-1111-4111-8111-111111111111" },
      {},
    );

    expect(result.redirect).toBe("/admin");
    expect(result.portalType).toBe("TENANT");
    expect(createSession).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ portal_type: "SUPER_ADMIN", id: "credential-1" }),
      "hashed-token",
      expect.any(Date),
      expect.any(Date),
      {},
      { portalType: "TENANT", tenantId: "11111111-1111-4111-8111-111111111111" },
    );
  });

  test("rejects employee workspace when the membership has no employee or manager role", async () => {
    const service = new PortalAuthService(
      {
        withTransaction: async (work: (client: unknown) => Promise<unknown>) => work({}),
        listCurrentUserContexts: vi.fn().mockResolvedValue([
          {
            context_type: "tenant",
            tenant_id: "11111111-1111-4111-8111-111111111111",
            tenant_code: "abc",
            tenant_name: "ABC",
            membership_id: "membership-1",
            display_title: null,
            roles: ["TENANT_ADMIN"],
            has_employee: false,
          },
        ]),
        findActiveCredentialByUserId: vi.fn(),
        createSession: vi.fn(),
      } as unknown as PortalAuthRepository,
      {} as PasswordService,
      { create: vi.fn(), hash: vi.fn() } as unknown as OpaqueSessionTokenService,
    );

    await expect(
      service.switchContext(
        "user-1",
        { workspace: "employee", tenantId: "11111111-1111-4111-8111-111111111111" },
        {},
      ),
    ).rejects.toMatchObject({ response: { code: "WORKSPACE_NOT_AVAILABLE" } });
  });
});

test("selects the tenant membership when Super Admin also has a session tenant", async () => {
  const platform: AuthContextRow = {
    user_id: "user-1",
    user_email: "owner@example.com",
    user_display_name: "Owner",
    user_status: "active",
    tenant_id: null,
    tenant_code: null,
    tenant_display_name: null,
    tenant_status: null,
    membership_id: null,
    membership_status: null,
    membership_display_name: null,
    membership_timezone: null,
    role_codes: ["SUPER_ADMIN"],
    permission_codes: ["tenant.create"],
  };
  const membership: AuthContextRow = {
    ...platform,
    tenant_id: "tenant-1",
    tenant_code: "abc",
    tenant_display_name: "ABC",
    tenant_status: "active",
    membership_id: "membership-1",
    membership_status: "active",
    membership_display_name: "Owner",
    membership_timezone: "Asia/Kolkata",
    role_codes: ["TENANT_ADMIN", "EMPLOYEE", "MANAGER"],
    permission_codes: ["client.read"],
  };
  const resolver = new RequestContextResolver({
    findByApplicationUserId: vi.fn().mockResolvedValue([platform, membership]),
  } as unknown as AuthContextRepository);

  const resolved = await resolver.resolve(
    {
      authUserId: "user-1",
      sessionId: "session-1",
      portalType: "TENANT",
      tenantId: "tenant-1",
      issuer: "portal-session",
      audience: ["portal-session"],
      expiresAt: new Date("2026-08-19T10:00:00.000Z"),
    },
    { portal: "admin", tenantId: "tenant-1" },
    "request-4",
  );

  expect(resolved.context.isPlatformAdmin).toBe(false);
  expect(resolved.context.tenantId).toBe("tenant-1");
  expect(resolved.context.roles).toEqual(["TENANT_ADMIN", "EMPLOYEE", "MANAGER"]);
});
