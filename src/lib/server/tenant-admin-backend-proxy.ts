import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  superAdminAccessTokenCookie,
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
} from "@/lib/auth-cookies";
import { refreshSuperAdminSession } from "@/lib/server/super-admin-auth";
import { clearSuperAdminSessionCookies, setSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";
import { backendApiBaseUrl } from "@/lib/server/backend-api-url";

type ProxyOptions = {
  readonly path: string;
  readonly init?: RequestInit;
  readonly unauthenticatedMessage?: string;
  readonly unavailableMessage?: string;
};

export async function proxyTenantAdminBackend({
  path,
  init,
  unauthenticatedMessage = "Tenant Admin session required.",
  unavailableMessage = "Tenant Admin service unavailable.",
}: ProxyOptions): Promise<NextResponse> {
  const startedAt = performance.now();
  const cookieStore = await cookies();
  const rememberMe = cookieStore.get(superAdminRememberMeCookie)?.value === "1";
  const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
  let refreshed: Awaited<ReturnType<typeof refreshSuperAdminSession>> = null;
  let accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;

  if (!accessToken && refreshToken) {
    refreshed = await refreshSession(refreshToken);
    accessToken = refreshed?.accessToken;
  }
    if (!accessToken) {
      const response = NextResponse.json({ message: unauthenticatedMessage }, { status: 401 });
      clearSuperAdminSessionCookies(response);
      return withTiming(response, path, init, startedAt);
  }

  try {
    let backendResponse = await fetchBackend(path, accessToken, init);
    if (backendResponse.status === 401 && refreshToken) {
      refreshed = await refreshSession(refreshToken);
      if (refreshed) {
        backendResponse = await fetchBackend(path, refreshed.accessToken, init);
      }
    }

    const response = await toJsonResponse(backendResponse);
    if (refreshed && backendResponse.status !== 401) {
      setSuperAdminSessionCookies(response, refreshed, rememberMe, "admin");
    }
    if (backendResponse.status === 401) {
      clearSuperAdminSessionCookies(response);
    }
    return withTiming(response, path, init, startedAt);
  } catch {
    return withTiming(NextResponse.json({ message: unavailableMessage }, { status: 503 }), path, init, startedAt);
  }
}

function withTiming(response: NextResponse, path: string, init: RequestInit | undefined, startedAt: number): NextResponse {
  const durationMs = Math.round(performance.now() - startedAt);
  response.headers.set("server-timing", `tenant-api;dur=${durationMs}`);
  if (durationMs >= 500) {
    const method = init?.method ?? "GET";
    const route = path.split("?")[0] ?? path;
    console.info(`[Page data] Tenant Admin ${method} ${route} finished with ${response.status} in ${durationMs}ms. This measures server data time, not browser rendering time.`);
  }
  return response;
}

async function refreshSession(
  refreshToken: string,
): ReturnType<typeof refreshSuperAdminSession> {
  return refreshSuperAdminSession(refreshToken).catch(() => null);
}

async function fetchBackend(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const request = {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-portal": "admin",
      ...init?.headers,
    },
    cache: "no-store" as const,
  };
  const canRetry = !init?.method || init.method.toUpperCase() === "GET";
  let response: Response | undefined;

  for (let attempt = 0; attempt < (canRetry ? 3 : 1); attempt += 1) {
    try {
      response = await fetch(`${backendApiBaseUrl()}${path}`, request);
    } catch (error) {
      if (!canRetry || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }
    if (!isTemporaryBackendStatus(response.status) || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  return response!;
}

function isTemporaryBackendStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

async function toJsonResponse(response: Response): Promise<NextResponse> {
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const text = await response.text();
  let body: unknown = { message: "Backend returned an empty response." };
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { message: "Tenant Admin service returned an invalid response." },
        { status: 502 },
      );
    }
  }
  return NextResponse.json(body, { status: response.status });
}
