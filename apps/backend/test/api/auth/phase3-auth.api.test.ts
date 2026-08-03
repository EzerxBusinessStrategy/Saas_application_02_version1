import { createServer, Server } from "node:http";
import { webcrypto } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestApp, testConfig } from "../../helpers/test-app";
import { AuthContextRepository, AuthContextRow } from "../../../src/auth/auth-context.repository";
import { SupabaseJwtVerifier } from "../../../src/auth/supabase-jwt-verifier.service";

const issuer = "https://auth.example.test/auth/v1";
const audience = "authenticated";
const authUserA = "77777777-7777-4777-8777-777777777777";
const authUserB = "88888888-8888-4888-8888-888888888888";
const authUserMissing = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const authUserSuspended = "99999999-9999-4999-8999-999999999999";
const authUserNoMembership = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const authUserSuperAdmin = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const tenantSuspended = "aaaaaaaa-1111-4111-8111-111111111111";
const userA = "33333333-3333-4333-8333-333333333333";
const userB = "44444444-4444-4444-8444-444444444444";
const userSuspended = "99999999-9999-4999-8999-999999999999";
const membershipA = "55555555-5555-4555-8555-555555555555";
const membershipB = "66666666-6666-4666-8666-666666666666";
const membershipSuspendedTenant = "aaaaaaaa-2222-4222-8222-222222222222";
const membershipInactive = "aaaaaaaa-3333-4333-8333-333333333333";

let jwksServer: Server;
let jwksUrl: string;

describe("Phase 3 Supabase authentication and trusted context", () => {
  let app: NestFastifyApplication | undefined;
  let keys: Awaited<ReturnType<typeof createJwtKeys>>;

  beforeAll(async () => {
    ensureWebCrypto();
    keys = await createJwtKeys();
    jwksServer = createServer((_, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [keys.publicJwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
    const address = jwksServer.address();
    if (typeof address !== "object" || !address) throw new Error("JWKS server did not start.");
    jwksUrl = `http://127.0.0.1:${address.port}/.well-known/jwks.json`;

  }, 120_000);

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
  });

  test("rejects requests without a bearer token", async () => {
    mockAuthRows({});
    app = await createAuthTestApp();

    const response = await request(app.getHttpServer()).get("/api/v1/me").expect(401);

    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  test("returns /me with safe verified user and tenant fields", async () => {
    mockAuthRows(defaultRows());
    mockVerifiedAuthUser(authUserA);
    app = await createAuthTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantA)
      .set("x-portal", "admin")
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: userA,
        authUserId: authUserA,
        email: "user-a@example.com",
        displayName: "User A",
        status: "active",
      },
      activeMembership: {
        id: membershipA,
        tenant: { id: tenantA, code: "tenant-a", status: "active" },
        roles: ["TENANT_ADMIN"],
      },
      roles: ["TENANT_ADMIN"],
      isPlatformAdmin: false,
      requestId: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain("raw_app_meta_data");
    expect(JSON.stringify(response.body)).not.toContain("rls");
    expect(response.body.permissions).toContain("client.read");
  });

  test("returns platform Super Admin /me without a tenant membership", async () => {
    mockAuthRows(defaultRows());
    mockVerifiedAuthUser(authUserSuperAdmin);
    app = await createAuthTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-portal", "super-admin")
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: "dddddddd-3333-4333-8333-333333333333",
        authUserId: authUserSuperAdmin,
        email: "super-admin@example.com",
        status: "active",
      },
      availableMemberships: [],
      activeMembership: null,
      roles: ["SUPER_ADMIN"],
      isPlatformAdmin: true,
    });
    expect(response.body.permissions).toContain("tenant.create");
  });

  test("rejects expired token, invalid signature, wrong issuer, wrong audience, and unsupported algorithm", async () => {
    mockAuthRows(defaultRows());
    app = await createAuthTestApp();
    const invalidKeys = await createJwtKeys();

    const cases = [
      signToken(keys.privateKey, authUserA, { expiresInSeconds: -10 }),
      signToken(invalidKeys.privateKey, authUserA),
      signToken(keys.privateKey, authUserA, { issuerOverride: "https://wrong.example.test/auth/v1" }),
      signToken(keys.privateKey, authUserA, { audienceOverride: "wrong-audience" }),
      signUnsupportedAlgorithmToken(authUserA),
    ];

    for (const tokenPromise of cases) {
      const response = await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("authorization", `Bearer ${await tokenPromise}`)
        .set("x-tenant-id", tenantA)
        .expect(401);
      expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
    }
  });

  test("denies missing and suspended application users", async () => {
    mockAuthRows(defaultRows());
    app = await createAuthTestApp();

    mockVerifiedAuthUser(authUserMissing);
    const missing = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantA)
      .expect(403);
    expect(missing.body.error.code).toBe("APPLICATION_USER_NOT_FOUND");

    mockVerifiedAuthUser(authUserNoMembership);
    const noMembership = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .expect(403);
    expect(noMembership.body.error.code).toBe("MEMBERSHIP_NOT_FOUND");

    mockVerifiedAuthUser(authUserSuspended);
    const suspended = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantA)
      .expect(403);
    expect(suspended.body.error.code).toBe("USER_SUSPENDED");
  });

  test("denies suspended tenant, inactive membership, invalid tenant input, and unassigned role", async () => {
    mockAuthRows(defaultRows());
    mockVerifiedAuthUser(authUserA);
    app = await createAuthTestApp();

    const suspendedTenantResponse = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantSuspended)
      .expect(403);
    expect(suspendedTenantResponse.body.error.code).toBe("TENANT_SUSPENDED");

    const inactiveMembershipResponse = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-code", "tenant-inactive-member")
      .expect(403);
    expect(inactiveMembershipResponse.body.error.code).toBe("MEMBERSHIP_INACTIVE");

    const invalidTenantResponse = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantB)
      .expect(403);
    expect(invalidTenantResponse.body.error.code).toBe("INVALID_TENANT_SELECTION");

    const roleResponse = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .set("x-tenant-id", tenantA)
      .set("x-role", "MANAGER")
      .expect(403);
    expect(roleResponse.body.error.code).toBe("ROLE_NOT_ASSIGNED");
  });

  test("requires tenant selection for users with multiple active memberships", async () => {
    mockAuthRows(defaultRows());
    mockVerifiedAuthUser(authUserB);
    app = await createAuthTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("authorization", "Bearer verified-token")
      .expect(409);

    expect(response.body.error.code).toBe("TENANT_SELECTION_REQUIRED");
  });

  test("keeps concurrent request contexts isolated", async () => {
    mockAuthRows(defaultRows());
    vi.spyOn(SupabaseJwtVerifier.prototype, "verifyBearerToken").mockImplementation(async (token) => ({
      authUserId: token === "token-b" ? authUserB : authUserA,
      issuer,
      audience: [audience],
      expiresAt: new Date(Date.now() + 300_000),
    }));
    app = await createAuthTestApp();

    const [responseA, responseB] = await Promise.all([
      request(app.getHttpServer())
        .get("/api/v1/me")
        .set("authorization", "Bearer token-a")
        .set("x-tenant-id", tenantA)
        .set("x-request-id", "req-phase3-a"),
      request(app.getHttpServer())
        .get("/api/v1/me")
        .set("authorization", "Bearer token-b")
        .set("x-tenant-id", tenantB)
        .set("x-request-id", "req-phase3-b"),
    ]);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(responseA.body.activeMembership.tenant.id).toBe(tenantA);
    expect(responseB.body.activeMembership.tenant.id).toBe(tenantB);
    expect(responseA.body.requestId).toBe("req-phase3-a");
    expect(responseB.body.requestId).toBe("req-phase3-b");
  });
});

function ensureWebCrypto(): void {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
  }
}

async function createAuthTestApp(): Promise<NestFastifyApplication> {
  return createTestApp({
    ...testConfig,
    supabaseUrl: "https://auth.example.test",
    supabaseJwtIssuer: issuer,
    supabaseJwtAudience: audience,
    supabaseJwksUrl: jwksUrl,
  });
}

async function createJwtKeys() {
  const jose = await import("jose");
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256", { extractable: true });
  return {
    privateKey,
    publicJwk: { ...(await jose.exportJWK(publicKey)), kid: "phase3-test-key", alg: "RS256", use: "sig" },
  };
}

async function signToken(
  privateKey: Awaited<ReturnType<typeof createJwtKeys>>["privateKey"],
  subject: string,
  options: {
    readonly expiresInSeconds?: number;
    readonly issuerOverride?: string;
    readonly audienceOverride?: string;
  } = {},
): Promise<string> {
  const jose = await import("jose");
  const expiresInSeconds = options.expiresInSeconds ?? 300;
  return new jose.SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "RS256", kid: "phase3-test-key" })
    .setSubject(subject)
    .setIssuer(options.issuerOverride ?? issuer)
    .setAudience(options.audienceOverride ?? audience)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(privateKey);
}

async function signUnsupportedAlgorithmToken(subject: string): Promise<string> {
  const jose = await import("jose");
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode("not-a-real-project-secret"));
}

function mockAuthRows(rows: Readonly<Record<string, readonly AuthContextRow[]>>): void {
  vi.spyOn(AuthContextRepository.prototype, "findBySupabaseAuthUserId").mockImplementation(
    async (authUserId) => rows[authUserId] ?? [],
  );
}

function mockVerifiedAuthUser(authUserId: string): void {
  vi.spyOn(SupabaseJwtVerifier.prototype, "verifyBearerToken").mockResolvedValue({
    authUserId,
    issuer,
    audience: [audience],
    expiresAt: new Date(Date.now() + 300_000),
  });
}

function defaultRows(): Readonly<Record<string, readonly AuthContextRow[]>> {
  return {
    [authUserA]: [
      row({
        userId: userA,
        authTenantId: tenantA,
        tenantCode: "tenant-a",
        membershipId: membershipA,
        roles: ["TENANT_ADMIN"],
        permissions: ["client.read", "tenant.read"],
      }),
      row({
        userId: userA,
        authTenantId: tenantSuspended,
        tenantCode: "tenant-suspended",
        membershipId: membershipSuspendedTenant,
        tenantStatus: "suspended",
        roles: ["TENANT_ADMIN"],
      }),
      row({
        userId: userA,
        authTenantId: "aaaaaaaa-4444-4444-8444-444444444444",
        tenantCode: "tenant-inactive-member",
        membershipId: membershipInactive,
        membershipStatus: "suspended",
        roles: ["TENANT_ADMIN"],
      }),
    ],
    [authUserB]: [
      row({
        userId: userB,
        authTenantId: tenantB,
        tenantCode: "tenant-b",
        membershipId: membershipB,
        roles: ["MANAGER"],
      }),
      row({
        userId: userB,
        authTenantId: tenantA,
        tenantCode: "tenant-a",
        membershipId: "aaaaaaaa-5555-4555-8555-555555555555",
        roles: ["EMPLOYEE"],
      }),
    ],
    [authUserSuspended]: [
      row({
        userId: userSuspended,
        authTenantId: tenantA,
        tenantCode: "tenant-a",
        membershipId: "aaaaaaaa-6666-4666-8666-666666666666",
        userStatus: "suspended",
      }),
    ],
    [authUserNoMembership]: [
      {
        user_id: "cccccccc-3333-4333-8333-333333333333",
        user_email: "no-membership@example.com",
        user_display_name: "No Membership",
        user_status: "active",
        tenant_id: null,
        tenant_code: null,
        tenant_display_name: null,
        tenant_status: null,
        membership_id: null,
        membership_status: null,
        membership_display_name: null,
        membership_timezone: null,
        role_codes: [],
        permission_codes: [],
      },
    ],
    [authUserSuperAdmin]: [
      {
        user_id: "dddddddd-3333-4333-8333-333333333333",
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
        permission_codes: ["tenant.create", "tenant.read"],
      },
    ],
  };
}

function row(input: {
  readonly userId: string;
  readonly authTenantId: string;
  readonly tenantCode: string;
  readonly membershipId: string;
  readonly userStatus?: string;
  readonly tenantStatus?: string;
  readonly membershipStatus?: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
}): AuthContextRow {
  return {
    user_id: input.userId,
    user_email: input.userId === userB ? "user-b@example.com" : "user-a@example.com",
    user_display_name: input.userId === userB ? "User B" : "User A",
    user_status: input.userStatus ?? "active",
    tenant_id: input.authTenantId,
    tenant_code: input.tenantCode,
    tenant_display_name: input.tenantCode,
    tenant_status: input.tenantStatus ?? "active",
    membership_id: input.membershipId,
    membership_status: input.membershipStatus ?? "active",
    membership_display_name: input.tenantCode,
    membership_timezone: "Asia/Kolkata",
    role_codes: input.roles ?? [],
    permission_codes: input.permissions ?? [],
  };
}
