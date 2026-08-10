import request from "supertest";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContextRepository, AuthContextRow } from "../../src/auth/auth-context.repository";
import { SessionPolicyRepository } from "../../src/auth/session-policy.repository";
import { SupabaseJwtVerifier } from "../../src/auth/supabase-jwt-verifier.service";
import { SuperAdminPlatformConfigurationRepository } from "../../src/platform/super-admin-platform-configuration.repository";
import { createTestApp } from "../helpers/test-app";

const authUserId = "77777777-7777-4777-8777-777777777777";
const userId = "33333333-3333-4333-8333-333333333333";

describe("super admin platform configuration", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  test("reads and updates the database-backed configuration for a permitted Super Admin", async () => {
    mockPlatformContext(["platform.configuration.read", "platform.configuration.update"]);
    vi.spyOn(SuperAdminPlatformConfigurationRepository.prototype, "get").mockResolvedValue(rows());
    const update = vi.spyOn(SuperAdminPlatformConfigurationRepository.prototype, "update").mockResolvedValue([
      { key: "platform_name", value: "Operations Hub" },
      { key: "default_brand_colour", value: "#9AA4C6" },
      { key: "email_sender_name", value: "Operations Hub" },
    ]);
    app = await createPlatformConfigurationTestApp();

    await request(app.getHttpServer())
      .get("/api/v1/super-admin/platform-configuration")
      .set("authorization", "Bearer verified-token")
      .expect(200, { platformName: "SaaS App", defaultBrand: "#3C50E0", senderName: "SaaS App" });

    await request(app.getHttpServer())
      .patch("/api/v1/super-admin/platform-configuration")
      .set("authorization", "Bearer verified-token")
      .send({ platformName: "Operations Hub", defaultBrand: "#9aa4c6", senderName: "Operations Hub" })
      .expect(200, { platformName: "Operations Hub", defaultBrand: "#9AA4C6", senderName: "Operations Hub" });

    expect(update).toHaveBeenCalledWith(expect.anything(), {
      platformName: "Operations Hub",
      defaultBrand: "#9aa4c6",
      senderName: "Operations Hub",
    });
  });

  test("denies a Super Admin without configuration permission", async () => {
    mockPlatformContext([]);
    app = await createPlatformConfigurationTestApp();

    await request(app.getHttpServer())
      .get("/api/v1/super-admin/platform-configuration")
      .set("authorization", "Bearer verified-token")
      .expect(403);
  });
});

async function createPlatformConfigurationTestApp(): Promise<NestFastifyApplication> {
  const testApp = await createTestApp();
  vi.spyOn(testApp.get(SupabaseJwtVerifier), "verifyBearerToken").mockResolvedValue({
    authUserId,
    sessionId: "test-session",
    email: "super-admin@example.com",
    issuer: "https://auth.example.test/auth/v1",
    audience: ["authenticated"],
    expiresAt: new Date(Date.now() + 300_000),
  });
  vi.spyOn(testApp.get(SessionPolicyRepository), "assertActive").mockResolvedValue({ auth_context_version: 1 });
  return testApp;
}

function mockPlatformContext(permissionCodes: readonly string[]): void {
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
      permission_codes: permissionCodes,
    } satisfies AuthContextRow,
  ]);
}

function rows() {
  return [
    { key: "platform_name" as const, value: "SaaS App" },
    { key: "default_brand_colour" as const, value: "#3C50E0" },
    { key: "email_sender_name" as const, value: "SaaS App" },
  ];
}
