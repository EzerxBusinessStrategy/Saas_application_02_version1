import { afterEach, expect, test, vi } from "vitest";
import {
  createEmployeeSessionPolicy,
  fetchVerifiedEmployeeMe,
  refreshSuperAdminSession,
  signInSuperAdminWithPassword,
  userFromEmployeeMe,
} from "@/lib/server/super-admin-auth";

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
  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    expect.any(String),
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
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

test("refreshes Supabase sessions with an abortable request", async () => {
  process.env.BACKEND_SUPABASE_URL = "https://project.supabase.co";
  process.env.BACKEND_SUPABASE_ANON_KEY = "anon-key";
  const fetchMock = vi.fn(async () =>
    jsonResponse({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 1800,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await expect(refreshSuperAdminSession("old-refresh-token")).resolves.toEqual({
    accessToken: "new-access-token",
    refreshToken: "new-refresh-token",
    expiresIn: 1800,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "https://project.supabase.co/auth/v1/token?grant_type=refresh_token",
    expect.objectContaining({
      method: "POST",
      signal: expect.any(AbortSignal),
    }),
  );
});

test("creates and verifies an employee portal session", async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000/api/v1";
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/session-policy")) return jsonResponse({ rememberMe: false });
    if (url.endsWith("/me")) {
      return jsonResponse({
        user: { email: "abc@emp.com", displayName: "abcdef" },
        activeMembership: { id: "membership" },
        roles: ["EMPLOYEE"],
        isPlatformAdmin: false,
      });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  await expect(createEmployeeSessionPolicy("employee-token", false)).resolves.toBe(true);
  const me = await fetchVerifiedEmployeeMe("employee-token");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "http://localhost:4000/api/v1/auth/session-policy",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-portal": "employee" }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "http://localhost:4000/api/v1/me",
    expect.objectContaining({
      headers: expect.objectContaining({ "x-portal": "employee" }),
    }),
  );
  expect(me).not.toBeNull();
  expect(userFromEmployeeMe(me!)).toMatchObject({
    email: "abc@emp.com",
    name: "abcdef",
    role: "EMPLOYEE",
  });
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}
