import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticatedWorkspaceCookie, demoSessionCookie, superAdminAccessTokenCookie } from "@/lib/auth-cookies";
import { clearSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";
import { revokeSessionPolicy } from "@/lib/server/super-admin-auth";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;
  const workspace = cookieStore.get(authenticatedWorkspaceCookie)?.value;
  if (accessToken && (workspace === "super-admin" || workspace === "admin")) {
    await revokeSessionPolicy(accessToken, workspace);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoSessionCookie, "", { maxAge: 0, path: "/" });
  clearSuperAdminSessionCookies(response);
  return response;
}
