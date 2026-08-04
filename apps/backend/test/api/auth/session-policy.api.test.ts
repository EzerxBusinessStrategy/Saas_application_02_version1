import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestApp } from "../../helpers/test-app";
import { AuthContextRepository, AuthContextRow } from "../../../src/auth/auth-context.repository";
import { SessionPolicyRepository } from "../../../src/auth/session-policy.repository";
import { SupabaseJwtVerifier } from "../../../src/auth/supabase-jwt-verifier.service";

const authUserId = "77777777-7777-4777-8777-777777777777";
const userId = "33333333-3333-4333-8333-333333333333";
const tenantId = "11111111-1111-4111-8111-111111111111";
const membershipId = "55555555-5555-4555-8555-555555555555";

describe("Tenant Administrator session policy", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  test("uses the verified Tenant Administrator context for login and explicit logout", async () => {
    app = await createTestApp();
    vi.spyOn(app.get(SupabaseJwtVerifier), "verifyBearerToken").mockResolvedValue({
      authUserId,
      sessionId: "tenant-session",
      email: "admin@tenant.test",
      issuer: "https://auth.example.test/auth/v1",
      audience: ["authenticated"],
      expiresAt: new Date(Date.now() + 300_000),
    });
    vi.spyOn(app.get(AuthContextRepository), "findBySupabaseAuthUserId").mockResolvedValue([tenantAdminRow]);
    const create = vi.spyOn(app.get(SessionPolicyRepository), "createOrRefresh").mockResolvedValue({
      remember_me: false,
      absolute_expires_at: new Date("2026-08-04T12:00:00.000Z"),
      created: true,
    });
    const revoke = vi.spyOn(app.get(SessionPolicyRepository), "revoke").mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post("/api/v1/auth/session-policy")
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "admin")
      .send({ rememberMe: false })
      .expect(201);
    await request(app.getHttpServer())
      .delete("/api/v1/auth/session-policy")
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "admin")
      .expect(204);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ tenantId, membershipId, roles: ["TENANT_ADMIN"] }), "tenant-session", false);
    expect(revoke).toHaveBeenCalledWith(expect.objectContaining({ tenantId, membershipId, roles: ["TENANT_ADMIN"] }), "tenant-session");
  });
});

const tenantAdminRow: AuthContextRow = {
  user_id: userId,
  user_email: "admin@tenant.test",
  user_display_name: "Tenant Admin",
  user_status: "active",
  tenant_id: tenantId,
  tenant_code: "TENANT001",
  tenant_display_name: "Tenant One",
  tenant_status: "active",
  membership_id: membershipId,
  membership_status: "active",
  membership_display_name: "Tenant Admin",
  membership_timezone: "Asia/Kolkata",
  role_codes: ["TENANT_ADMIN"],
  permission_codes: [],
};
