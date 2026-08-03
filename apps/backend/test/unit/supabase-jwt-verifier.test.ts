import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppConfig } from "../../src/config/app-config";
import { SupabaseJwtVerifier } from "../../src/auth/supabase-jwt-verifier.service";

const config: AppConfig = {
  environment: "test",
  appName: "test",
  port: 4000,
  logLevel: "silent",
  apiBasePath: "/api/v1",
  corsOrigins: [],
  requestBodyLimitBytes: 1024,
  databasePoolMax: 1,
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
  supabaseJwtIssuer: "https://example.supabase.co/auth/v1",
  supabaseJwtAudience: "authenticated",
  supabaseJwksUrl: "https://example.supabase.co/auth/v1/.well-known/jwks.json",
  supabaseJwksTimeoutMs: 1500,
};

describe("SupabaseJwtVerifier", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies legacy Supabase HS256 tokens through Supabase Auth", async () => {
    const authUserId = "0b33e0a9-bfae-4a47-9f70-b3314a465a34";
    const token = await new SignJWT({
      session_id: "session-123",
      email: "superadmin@abc.com",
      role: "authenticated",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(authUserId)
      .setIssuer(config.supabaseJwtIssuer!)
      .setAudience("authenticated")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("test-secret"));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: authUserId, email: "superadmin@abc.com" }), { status: 200 }),
    );

    await expect(new SupabaseJwtVerifier(config).verifyBearerToken(token)).resolves.toMatchObject({
      authUserId,
      sessionId: "session-123",
      email: "superadmin@abc.com",
    });
  });
});
