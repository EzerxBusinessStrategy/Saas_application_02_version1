import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
} from "@/lib/auth-cookies";
import { fetchVerifiedSuperAdminMe, refreshSuperAdminSession } from "@/lib/server/super-admin-auth";
import { clearSuperAdminSessionCookies, setSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
  const next = safeNextUrl(new URL(request.url).searchParams.get("next"));
  if (!refreshToken) redirect("/login");

  const refreshed = await refreshSuperAdminSession(refreshToken);
  if (!refreshed || !(await fetchVerifiedSuperAdminMe(refreshed.accessToken))) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearSuperAdminSessionCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  setSuperAdminSessionCookies(response, refreshed, cookieStore.get(superAdminRememberMeCookie)?.value === "1");
  return response;
}

function safeNextUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/super-admin";
  return value;
}
