import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  authenticatedWorkspaceCookie,
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
} from "@/lib/auth-cookies";
import {
  fetchVerifiedClientPortalMe,
  fetchVerifiedEmployeeMe,
  fetchVerifiedManagerMe,
  fetchVerifiedSuperAdminMe,
  fetchVerifiedTenantAdminMe,
  refreshSuperAdminSession,
} from "@/lib/server/super-admin-auth";
import { clearSuperAdminSessionCookies, setSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";
import type { Workspace } from "@/types/domain";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
  const next = safeNextUrl(new URL(request.url).searchParams.get("next"));
  const workspace = cookieStore.get(authenticatedWorkspaceCookie)?.value;
  const authWorkspace = workspaceFromCookie(workspace);
  if (!refreshToken) redirect("/login");

  const refreshed = await refreshSuperAdminSession(refreshToken);
  const validSession = refreshed && authWorkspace
    ? await fetchVerifiedWorkspaceMe(refreshed.accessToken, authWorkspace)
    : null;
  if (!refreshed || !authWorkspace || !validSession) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearSuperAdminSessionCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  setSuperAdminSessionCookies(
    response,
    refreshed,
    cookieStore.get(superAdminRememberMeCookie)?.value === "1",
    authWorkspace,
  );
  return response;
}

function fetchVerifiedWorkspaceMe(accessToken: string, workspace: Workspace) {
  if (workspace === "client") return fetchVerifiedClientPortalMe(accessToken);
  if (workspace === "admin") return fetchVerifiedTenantAdminMe(accessToken);
  if (workspace === "manager") return fetchVerifiedManagerMe(accessToken);
  if (workspace === "employee") return fetchVerifiedEmployeeMe(accessToken);
  return fetchVerifiedSuperAdminMe(accessToken);
}

function workspaceFromCookie(value: string | undefined): Workspace | null {
  if (
    value === "super-admin" ||
    value === "admin" ||
    value === "manager" ||
    value === "employee" ||
    value === "client"
  ) {
    return value;
  }
  return null;
}

function safeNextUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/super-admin";
  return value;
}
