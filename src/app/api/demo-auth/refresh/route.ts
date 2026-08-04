import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  authenticatedWorkspaceCookie,
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
} from "@/lib/auth-cookies";
import { fetchVerifiedSuperAdminMe, fetchVerifiedTenantAdminMe, refreshSuperAdminSession } from "@/lib/server/super-admin-auth";
import { clearSuperAdminSessionCookies, setSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
  const next = safeNextUrl(new URL(request.url).searchParams.get("next"));
  const workspace = cookieStore.get(authenticatedWorkspaceCookie)?.value;
  if (!refreshToken) redirect("/login");

  const refreshed = await refreshSuperAdminSession(refreshToken);
  const validSession = refreshed && (
    workspace === "admin"
      ? await fetchVerifiedTenantAdminMe(refreshed.accessToken)
      : await fetchVerifiedSuperAdminMe(refreshed.accessToken)
  );
  if (!refreshed || !validSession) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearSuperAdminSessionCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  setSuperAdminSessionCookies(
    response,
    refreshed,
    cookieStore.get(superAdminRememberMeCookie)?.value === "1",
    workspace === "admin" ? "admin" : "super-admin",
  );
  return response;
}

function safeNextUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/super-admin";
  return value;
}
