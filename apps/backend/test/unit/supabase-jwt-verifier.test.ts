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
    vi.unstubAllGlobals();
  });

  it("verifies legacy Supabase HS256 tokens through Supabase Auth", async () => {
    const authUserId = "0b33e0a9-bfae-4a47-9f70-b3314a465a34";
    const token = legacySupabaseToken({
      sub: authUserId,
      session_id: "session-123",
      email: "superadmin@abc.com",
      iss: config.supabaseJwtIssuer!,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const jose = await import("jose");
    expect(jose.decodeProtectedHeader(token)).toMatchObject({ alg: "HS256" });
    expect(jose.decodeJwt(token)).toMatchObject({
      sub: authUserId,
      iss: config.supabaseJwtIssuer,
      aud: "authenticated",
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: authUserId, email: "superadmin@abc.com" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const verifier = new SupabaseJwtVerifier(config);
    // The production loader uses an indirect import so Node can load the ESM-only
    // jose package. Vitest does not resolve that indirect import; inject the same
    // module namespace here without changing production authentication behavior.
    (verifier as unknown as { getJose(): Promise<typeof jose> }).getJose = async () => jose;

    await expect(verifier.verifyBearerToken(token)).resolves.toMatchObject({
      authUserId,
      sessionId: "session-123",
      email: "superadmin@abc.com",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/user",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }),
    );
  });
});

function legacySupabaseToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.supabase-validates-this-signature`;
}
