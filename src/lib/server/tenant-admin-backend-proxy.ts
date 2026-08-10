import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  superAdminAccessTokenCookie,
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
} from "@/lib/auth-cookies";
import { refreshSuperAdminSession } from "@/lib/server/super-admin-auth";
import { clearSuperAdminSessionCookies, setSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";

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
    return response;
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
    return response;
  } catch {
    return NextResponse.json({ message: unavailableMessage }, { status: 503 });
  }
}

async function refreshSession(
  refreshToken: string,
): ReturnType<typeof refreshSuperAdminSession> {
  return refreshSuperAdminSession(refreshToken).catch(() => null);
}

function fetchBackend(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  return fetch(`${backendApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-portal": "admin",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

async function toJsonResponse(response: Response): Promise<NextResponse> {
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const text = await response.text();
  const body = text ? JSON.parse(text) : { message: "Backend returned an empty response." };
  return NextResponse.json(body, { status: response.status });
}

export function backendApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  const fallback = "http://localhost:4000/api/v1";
  return (!configured || configured === "https://api.example.com" ? fallback : configured).replace(/\/+$/, "");
}
