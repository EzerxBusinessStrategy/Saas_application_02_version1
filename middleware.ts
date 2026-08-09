import { NextResponse, type NextRequest } from "next/server";
import { demoSessionCookie, isWorkspaceAllowed, roleFromSession } from "@/lib/demo-auth";
import { authenticatedWorkspaceCookie, superAdminAccessTokenCookie } from "@/lib/auth-cookies";
import type { Workspace } from "@/types/domain";

const protectedWorkspaces = new Set<Workspace>([
  "super-admin",
  "admin",
  "manager",
  "employee",
  "client",
]);

export function middleware(request: NextRequest) {
  const workspace = request.nextUrl.pathname.split("/")[1] as Workspace;
  if (!protectedWorkspaces.has(workspace)) return NextResponse.next();

  if (workspace === "super-admin") {
    return request.cookies.get(superAdminAccessTokenCookie)?.value
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    request.cookies.get(superAdminAccessTokenCookie)?.value &&
    request.cookies.get(authenticatedWorkspaceCookie)?.value === workspace
  ) {
    return NextResponse.next();
  }

  const role = roleFromSession(request.cookies.get(demoSessionCookie)?.value);
  if (!role) return NextResponse.redirect(new URL("/login", request.url));
  if (!isWorkspaceAllowed(role, workspace)) {
    return NextResponse.redirect(new URL("/no-permission", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/super-admin/:path*", "/admin/:path*", "/manager/:path*", "/employee/:path*", "/client/:path*"],
};
