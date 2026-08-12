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

export async function proxyClientPortalBackend({
  path,
  init,
  unauthenticatedMessage = "Client portal session required.",
  unavailableMessage = "Client portal service unavailable.",
}: ProxyOptions): Promise<NextResponse> {
  const cookieStore = await cookies();
  const rememberMe = cookieStore.get(superAdminRememberMeCookie)?.value === "1";
  const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
  let refreshed: Awaited<ReturnType<typeof refreshSuperAdminSession>> = null;
  let accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;

  if (!accessToken && refreshToken) {
    refreshed = await refreshSuperAdminSession(refreshToken);
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
      refreshed = await refreshSuperAdminSession(refreshToken);
      if (refreshed) backendResponse = await fetchBackend(path, refreshed.accessToken, init);
    }
    const response = await toJsonResponse(backendResponse);
    if (refreshed && backendResponse.status !== 401) {
      setSuperAdminSessionCookies(response, refreshed, rememberMe, "client");
    }
    if (backendResponse.status === 401) clearSuperAdminSessionCookies(response);
    return response;
  } catch {
    return NextResponse.json({ message: unavailableMessage }, { status: 503 });
  }
}

function fetchBackend(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  return fetch(`${backendApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-portal": "client",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

async function toJsonResponse(response: Response): Promise<NextResponse> {
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const text = await response.text();
  return NextResponse.json(text ? JSON.parse(text) : { message: "Backend returned an empty response." }, {
    status: response.status,
  });
}
