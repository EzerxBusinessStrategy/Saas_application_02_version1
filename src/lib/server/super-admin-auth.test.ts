import { afterEach, expect, test, vi } from "vitest";
import { signInSuperAdminWithPassword } from "@/lib/server/super-admin-auth";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BACKEND_SUPABASE_URL;
  delete process.env.BACKEND_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
});

test("signs in Super Admin through Supabase and verifies backend context", async () => {
  process.env.BACKEND_SUPABASE_URL = "https://project.supabase.co";
  process.env.BACKEND_SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000/api/v1";
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.includes("/auth/v1/token")) {
      return jsonResponse({ access_token: "jwt-access-token", refresh_token: "jwt-refresh-token", expires_in: 3600 });
    }
    if (url.endsWith("/me")) {
      return jsonResponse({
        user: { email: "owner@example.com", displayName: "Platform Owner" },
        activeMembership: null,
        roles: ["SUPER_ADMIN"],
        isPlatformAdmin: true,
      });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const session = await signInSuperAdminWithPassword({
    email: "owner@example.com",
    password: "correct-password",
  });

  expect(session?.accessToken).toBe("jwt-access-token");
  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "https://project.supabase.co/auth/v1/token?grant_type=password",
    expect.objectContaining({ method: "POST" }),
  );
  expect(session?.refreshToken).toBe("jwt-refresh-token");
});

test("rejects a valid Supabase password login without backend Super Admin authority", async () => {
  process.env.BACKEND_SUPABASE_URL = "https://project.supabase.co";
  process.env.BACKEND_SUPABASE_ANON_KEY = "anon-key";
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.includes("/auth/v1/token")) {
      return jsonResponse({ access_token: "tenant-token", refresh_token: "tenant-refresh-token", expires_in: 3600 });
    }
    return jsonResponse({
      user: { email: "tenant@example.com", displayName: "Tenant Admin" },
      activeMembership: { id: "membership" },
      roles: ["TENANT_ADMIN"],
      isPlatformAdmin: false,
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  await expect(signInSuperAdminWithPassword({ email: "tenant@example.com", password: "correct-password" })).resolves.toMatchObject({ accessToken: "tenant-token" });
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}
