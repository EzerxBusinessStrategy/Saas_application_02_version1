import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestApp } from "../../helpers/test-app";
import { AccessAdminRepository } from "../../../src/auth/access-admin.repository";
import { AccessAdminService } from "../../../src/auth/access-admin.service";
import { AuthContextRepository, AuthContextRow } from "../../../src/auth/auth-context.repository";
import { SessionPolicyRepository } from "../../../src/auth/session-policy.repository";
import { SupabaseJwtVerifier } from "../../../src/auth/supabase-jwt-verifier.service";

const authUserId = "77777777-7777-4777-8777-777777777777";
const userId = "33333333-3333-4333-8333-333333333333";
const tenantId = "11111111-1111-4111-8111-111111111111";
const membershipId = "55555555-5555-4555-8555-555555555555";
const targetMembershipId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const createdTenantId = "cccccccc-1111-4111-8111-111111111111";
const financialYearId = "dddddddd-1111-4111-8111-111111111111";

describe("administrator-controlled access and membership", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    verifiedEmail = undefined;
    vi.restoreAllMocks();
  });

  test("allows a Tenant Owner to create a tenant-scoped manager invitation", async () => {
    mockVerifiedAuthUser("owner@tenant.test");
    mockAuthRows(["TENANT_OWNER"], ["invitation.create"]);
    vi.spyOn(AccessAdminRepository.prototype, "createInvitation").mockResolvedValue({
      invitation_id: invitationId,
      role_code: "MANAGER",
      status: "pending",
      expires_at: new Date("2026-07-29T10:00:00.000Z"),
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/v1/invitations")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantId)
      .send({ email: "priya@abctech.com", displayName: "Priya Sen", roleCode: "MANAGER" })
      .expect(201);

    expect(response.body).toEqual({
      id: invitationId,
      email: "priya@abctech.com",
      roleCode: "MANAGER",
      status: "pending",
      expiresAt: "2026-07-29T10:00:00.000Z",
    });
  });

  test("allows a platform Super Admin to create a tenant without tenant membership headers", async () => {
    mockVerifiedAuthUser("super-admin@example.com");
    mockPlatformAuthRows();
    vi.spyOn(AccessAdminService.prototype, "createTenantWithOwnerInvitation").mockResolvedValue({
      tenantId: createdTenantId,
      financialYearId,
      membershipId,
      tenantStatus: "active",
    });
    vi.spyOn(AccessAdminRepository.prototype, "listTenantCreationTemplates").mockResolvedValue([
      {
        id: "eeeeeeee-1111-4111-8111-111111111111",
        country_code: "IN",
        name: "India April to March financial year",
        policy_mode: "COUNTRY_FIXED",
        start_month: 4,
        start_day: 1,
        end_month: 3,
        end_day: 31,
        confirmation_required: true,
        custom_allowed: true,
        maximum_period_days: 366,
        supports_52_53_week: false,
        metadata: { defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata" },
      },
    ]);
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/v1/super-admin/tenants")
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .send({
        company: {
          displayName: "ABC Technologies",
          legalName: "ABC Technologies Private Limited",
          tenantCode: "ABC001",
          slug: "abc-technologies",
          countryCode: "IN",
          reportingCurrencyCode: "INR",
          timezone: "Asia/Kolkata",
        },
        financialYear: {
          source: "COUNTRY_SUGGESTION_CONFIRMED",
          label: "FY 2026-27",
          startsOn: "2026-04-01",
          endsOn: "2027-03-31",
          templateId: "eeeeeeee-1111-4111-8111-111111111111",
        },
        tenantAdministrator: {
          fullName: "Rahul Sharma",
          email: "rahul@abctech.com",
          password: "tenant-admin-password",
          phone: "+919876543210",
        },
      })
      .expect(201);

    expect(response.body).toEqual({
      tenantId: createdTenantId,
      financialYearId,
      membershipId,
      tenantStatus: "active",
    });
  });

  test("allows a Super Admin to cancel a pending Tenant Admin invitation", async () => {
    mockVerifiedAuthUser("super-admin@example.com");
    mockPlatformAuthRows(["invitation.cancel"]);
    vi.spyOn(AccessAdminRepository.prototype, "closeInvitation").mockResolvedValue({
      invitation_id: invitationId,
      status: "cancelled",
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invitationId}/cancel`)
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .send({ reason: "Wrong Tenant Administrator email." })
      .expect(200);

    expect(response.body).toEqual({ invitationId, status: "cancelled" });
  });

  test("returns database-backed country and financial-year tenant filters to a Super Admin", async () => {
    mockVerifiedAuthUser("super-admin@example.com");
    mockPlatformAuthRows(["tenant.read"]);
    vi.spyOn(AccessAdminService.prototype, "listTenantFilters").mockResolvedValue({
      countries: ["IN"],
      financialYears: [{ countryCode: "IN", label: "FY 2026-27" }],
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/super-admin/tenant-list-filters")
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .expect(200);

    expect(response.body).toEqual({
      countries: ["IN"],
      financialYears: [{ countryCode: "IN", label: "FY 2026-27" }],
    });
  });

  test("checks Tenant Administrator email availability for tenant creation", async () => {
    mockVerifiedAuthUser("super-admin@example.com");
    mockPlatformAuthRows();
    vi.spyOn(AccessAdminService.prototype, "getEmailAvailability").mockResolvedValue({
      available: false,
      reason: "EMAIL_ALREADY_EXISTS",
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/super-admin/users/email-availability")
      .query({ email: "admin@abc.com" })
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .expect(200);

    expect(response.body).toEqual({ available: false, reason: "EMAIL_ALREADY_EXISTS" });
  });

  test("returns a conflict instead of a server error for an invalid tenant lifecycle transition", async () => {
    mockVerifiedAuthUser("super-admin@example.com");
    mockPlatformAuthRows(["tenant.read", "tenant.suspend"]);
    vi.spyOn(AccessAdminRepository.prototype, "setTenantStatus").mockRejectedValue({ code: "P0001" });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/super-admin/tenants/${tenantId}/status`)
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .send({ status: "suspended", suspensionDuration: "24h" })
      .expect(409);

    expect(response.body.error.code).toBe("TENANT_STATUS_TRANSITION_INVALID");
  });

  test("requires explicit confirmation before a Super Admin can revoke a tenant", async () => {
    mockVerifiedAuthUser("super-admin@example.com");
    mockPlatformAuthRows(["tenant.read", "tenant.revoke"]);
    const repositorySpy = vi.spyOn(AccessAdminRepository.prototype, "setTenantStatus");
    app = await createAccessAdminTestApp();

    await request(app.getHttpServer())
      .patch(`/api/v1/super-admin/tenants/${tenantId}/status`)
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .send({ status: "revoked" })
      .expect(400);

    expect(repositorySpy).not.toHaveBeenCalled();
  });

  test("allows a Super Admin to reset the active Tenant Administrator password", async () => {
    mockVerifiedAuthUser("super-admin@example.com");
    mockPlatformAuthRows(["tenant.update"]);
    vi.spyOn(AccessAdminService.prototype, "resetTenantAdministratorPassword").mockResolvedValue({
      tenantId,
      email: "admin@tenant.test",
      passwordChangedAt: "2026-08-04T00:00:00.000Z",
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/super-admin/tenants/${tenantId}/password`)
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .send({ password: "replacement-password" })
      .expect(200);

    expect(response.body).toEqual({
      tenantId,
      email: "admin@tenant.test",
      passwordChangedAt: "2026-08-04T00:00:00.000Z",
    });
  });

  test("denies Tenant Admin role escalation to Tenant Owner", async () => {
    mockVerifiedAuthUser("admin@tenant.test");
    mockAuthRows(["TENANT_ADMIN"], ["invitation.create"]);
    const repositorySpy = vi.spyOn(AccessAdminRepository.prototype, "createInvitation");
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/v1/invitations")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantId)
      .send({ email: "owner@abctech.com", displayName: "Owner", roleCode: "TENANT_OWNER" })
      .expect(403);

    expect(response.body.error.code).toBe("INVITATION_ROLE_NOT_ALLOWED");
    expect(repositorySpy).not.toHaveBeenCalled();
  });

  test("denies invitation creation when the active membership lacks permission", async () => {
    mockVerifiedAuthUser("employee@tenant.test");
    mockAuthRows(["EMPLOYEE"], []);
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/v1/invitations")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantId)
      .send({ email: "employee2@abctech.com", displayName: "Employee", roleCode: "EMPLOYEE" })
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  test("accepts an invitation only with a verified Supabase email", async () => {
    mockVerifiedAuthUser("priya@abctech.com");
    vi.spyOn(AccessAdminRepository.prototype, "acceptInvitation").mockResolvedValue({
      tenant_id: tenantId,
      user_id: userId,
      membership_id: membershipId,
      role_code: "MANAGER",
      status: "active",
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invitationId}/accept`)
      .set("authorization", "Bearer verified-token")
      .send({ displayName: "Priya Sen" })
      .expect(200);

    expect(response.body).toEqual({
      tenantId,
      userId,
      membershipId,
      roleCode: "MANAGER",
      status: "active",
    });
  });

  test("rejects invitation acceptance when the token has no verified email claim", async () => {
    mockVerifiedAuthUser(undefined);
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invitationId}/accept`)
      .set("authorization", "Bearer verified-token")
      .send({})
      .expect(403);

    expect(response.body.error.code).toBe("VERIFIED_INVITE_EMAIL_REQUIRED");
  });

  test("revokes membership access without deleting the membership record", async () => {
    mockVerifiedAuthUser("owner@tenant.test");
    mockAuthRows(["TENANT_OWNER"], ["membership.revoke"]);
    vi.spyOn(AccessAdminRepository.prototype, "revokeMembership").mockResolvedValue({
      membership_id: targetMembershipId,
      status: "revoked",
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/memberships/${targetMembershipId}/revoke`)
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantId)
      .send({ reason: "Employee left the organisation." })
      .expect(200);

    expect(response.body).toEqual({ membershipId: targetMembershipId, status: "revoked" });
  });

  test("reactivates a revoked membership with one reviewed role", async () => {
    mockVerifiedAuthUser("owner@tenant.test");
    mockAuthRows(["TENANT_OWNER"], ["membership.reactivate"]);
    vi.spyOn(AccessAdminRepository.prototype, "reactivateMembership").mockResolvedValue({
      membership_id: targetMembershipId,
      status: "active",
      role_code: "EMPLOYEE",
    });
    app = await createAccessAdminTestApp();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/memberships/${targetMembershipId}/reactivate`)
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantId)
      .send({ roleCode: "EMPLOYEE" })
      .expect(200);

    expect(response.body).toEqual({
      membershipId: targetMembershipId,
      status: "active",
      roleCode: "EMPLOYEE",
    });
  });
});

let verifiedEmail: string | undefined;

async function createAccessAdminTestApp(): Promise<NestFastifyApplication> {
  const testApp = await createTestApp();
  vi.spyOn(testApp.get(SupabaseJwtVerifier), "verifyBearerToken").mockResolvedValue({
    authUserId,
    sessionId: "test-session",
    email: verifiedEmail,
    issuer: "https://auth.example.test/auth/v1",
    audience: ["authenticated"],
    expiresAt: new Date(Date.now() + 300_000),
  });
  vi.spyOn(testApp.get(SessionPolicyRepository), "assertActive").mockResolvedValue({ auth_context_version: 1 });
  return testApp;
}

function mockVerifiedAuthUser(email: string | undefined): void {
  verifiedEmail = email;
}

function mockAuthRows(roles: readonly string[], permissions: readonly string[]): void {
  vi.spyOn(AuthContextRepository.prototype, "findBySupabaseAuthUserId").mockResolvedValue([
    {
      user_id: userId,
      user_email: "actor@tenant.test",
      user_display_name: "Actor",
      user_status: "active",
      tenant_id: tenantId,
      tenant_code: "tenant-a",
      tenant_display_name: "Tenant A",
      tenant_status: "active",
      membership_id: membershipId,
      membership_status: "active",
      membership_display_name: "Actor",
      membership_timezone: "Asia/Kolkata",
      role_codes: roles,
      permission_codes: permissions,
    } satisfies AuthContextRow,
  ]);
}

function mockPlatformAuthRows(extraPermissions: readonly string[] = []): void {
  vi.spyOn(AuthContextRepository.prototype, "findBySupabaseAuthUserId").mockResolvedValue([
    {
      user_id: userId,
      user_email: "super-admin@example.com",
      user_display_name: "Super Admin",
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
      permission_codes: ["tenant.create", ...extraPermissions],
    } satisfies AuthContextRow,
  ]);
}
