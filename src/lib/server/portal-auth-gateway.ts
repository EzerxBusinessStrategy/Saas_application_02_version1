import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieForPortal, type PortalKey } from "@/lib/auth-cookies";
import { backendApiBaseUrl } from "@/lib/server/backend-api-url";
import {
  backendStartingMessage,
  isBackendStartingResponse,
  parseBackendJson,
} from "@/lib/server/backend-response";

const portalHeader: Record<PortalKey, string> = { "super-admin": "super-admin", tenant: "admin", employee: "employee", client: "client" };
const loginRetryDelaysMs = [2_000, 4_000, 8_000, 12_000] as const;

export async function loginPortal(portal: PortalKey, request: Request): Promise<NextResponse> {
  try {
    const body = await request.text();
    const headers = requestMetadataHeaders(request, { "content-type": "application/json" });
    const { status, payload } = await fetchBackendLogin(portal, headers, body);
    if (!isLoginResponse(payload)) {
      const starting = payload && typeof payload === "object" && "message" in payload
        && (payload as { message?: unknown }).message === backendStartingMessage;
      return NextResponse.json(payload, { status: starting ? 503 : status });
    }
    const response = NextResponse.json({ redirect: payload.redirect });
    response.cookies.set(sessionCookieForPortal(portal), payload.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(payload.expiresAt) });
    return response;
  } catch {
    return NextResponse.json({ message: "Authentication service is unavailable." }, { status: 503 });
  }
}

export async function logoutPortal(portal: PortalKey, request: Request): Promise<NextResponse> {
  const token = (await cookies()).get(sessionCookieForPortal(portal))?.value;
  if (token) {
    try {
      const backend = await fetch(`${backendApiBaseUrl()}/auth/${portal}/logout`, {
        method: "POST",
        headers: requestMetadataHeaders(request, {
          cookie: `${sessionCookieForPortal(portal)}=${encodeURIComponent(token)}`,
          "x-portal": portalHeader[portal],
        }),
        cache: "no-store",
      });
      if (!backend.ok && backend.status !== 401) {
        return NextResponse.json({ message: "Sign out could not be completed. Please try again." }, { status: 503 });
      }
    } catch {
      return NextResponse.json({ message: "Sign out could not be completed. Please try again." }, { status: 503 });
    }
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(sessionCookieForPortal(portal), "", { maxAge: 0, path: "/" });
  return response;
}

export async function proxyPortalBackend(portal: PortalKey, options: { path: string; init?: RequestInit; unauthenticatedMessage: string; unavailableMessage: string }): Promise<NextResponse> {
  const token = (await cookies()).get(sessionCookieForPortal(portal))?.value;
  if (!token) return NextResponse.json({ message: options.unauthenticatedMessage }, { status: 401 });
  try {
    const headers = new Headers(options.init?.headers);
    headers.set("cookie", `${sessionCookieForPortal(portal)}=${encodeURIComponent(token)}`);
    headers.set("x-portal", portalHeader[portal]);
    const backend = await fetch(`${backendApiBaseUrl()}${options.path}`, { ...options.init, headers, cache: "no-store" });
    const response = NextResponse.json(parseBackendJson(backend.status, await backend.text()), { status: backend.status });
    if (backend.status === 401) response.cookies.set(sessionCookieForPortal(portal), "", { maxAge: 0, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ message: options.unavailableMessage }, { status: 503 });
  }
}

async function fetchBackendLogin(
  portal: PortalKey,
  headers: Headers,
  body: string,
): Promise<{ status: number; payload: unknown }> {
  let lastStatus = 503;
  let lastPayload: unknown = { message: backendStartingMessage };

  for (let attempt = 0; attempt <= loginRetryDelaysMs.length; attempt += 1) {
    const backend = await fetch(`${backendApiBaseUrl()}/auth/${portal}/login`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
    const text = await backend.text();
    lastStatus = backend.status;
    lastPayload = parseBackendJson(backend.status, text);
    if (!isBackendStartingResponse(backend.status, text)) {
      return { status: backend.status, payload: lastPayload };
    }
    const delay = loginRetryDelaysMs[attempt];
    if (delay === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return { status: lastStatus, payload: lastPayload };
}

function isLoginResponse(value: unknown): value is { token: string; expiresAt: string; redirect: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const expiresAt =
    typeof record.expiresAt === "string"
      ? record.expiresAt
      : record.expiresAt instanceof Date
        ? record.expiresAt.toISOString()
        : undefined;
  if (expiresAt) record.expiresAt = expiresAt;
  return typeof record.token === "string" && typeof expiresAt === "string" && typeof record.redirect === "string";
}

function requestMetadataHeaders(request: Request, headers: HeadersInit): Headers {
  const forwarded = new Headers(headers);
  for (const name of ["user-agent", "x-forwarded-for", "x-real-ip"]) {
    const value = request.headers.get(name);
    if (value) forwarded.set(name, value);
  }
  return forwarded;
}
