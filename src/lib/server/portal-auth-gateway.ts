import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieForPortal, type PortalKey } from "@/lib/auth-cookies";
import { backendApiBaseUrl } from "@/lib/server/backend-api-url";

const portalHeader: Record<PortalKey, string> = { "super-admin": "super-admin", tenant: "admin", employee: "employee", client: "client" };

export async function loginPortal(portal: PortalKey, request: Request): Promise<NextResponse> {
  try {
    const backend = await fetch(`${backendApiBaseUrl()}/auth/${portal}/login`, {
      method: "POST",
      headers: requestMetadataHeaders(request, { "content-type": "application/json" }),
      body: await request.text(),
      cache: "no-store",
    });
    const payload = await parseBody(backend);
    if (!backend.ok || !isLoginResponse(payload)) return NextResponse.json(payload, { status: backend.status });
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
    const response = NextResponse.json(await parseBody(backend), { status: backend.status });
    if (backend.status === 401) response.cookies.set(sessionCookieForPortal(portal), "", { maxAge: 0, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ message: options.unavailableMessage }, { status: 503 });
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return {};
  const text = await response.text();
  if (!text) return { message: "Backend returned an empty response." };
  try { return JSON.parse(text); } catch { return { message: "Backend returned an invalid response." }; }
}

function isLoginResponse(value: unknown): value is { token: string; expiresAt: string; redirect: string } {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).token === "string" && typeof (value as Record<string, unknown>).expiresAt === "string" && typeof (value as Record<string, unknown>).redirect === "string";
}

function requestMetadataHeaders(request: Request, headers: HeadersInit): Headers {
  const forwarded = new Headers(headers);
  for (const name of ["user-agent", "x-forwarded-for", "x-real-ip"]) {
    const value = request.headers.get(name);
    if (value) forwarded.set(name, value);
  }
  return forwarded;
}
