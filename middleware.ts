import { NextResponse, type NextRequest } from "next/server";
import {
  clientSessionCookie,
  employeeSessionCookie,
  superAdminSessionCookie,
  tenantSessionCookie,
} from "@/lib/auth-cookies";
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

  const sessionCookie = sessionCookieForWorkspace(workspace);
  if (request.cookies.get(sessionCookie)?.value) return NextResponse.next();

  return NextResponse.redirect(new URL(loginPathForWorkspace(workspace), request.url));
}

function sessionCookieForWorkspace(workspace: Workspace): string {
  if (workspace === "super-admin") return superAdminSessionCookie;
  if (workspace === "admin") return tenantSessionCookie;
  if (workspace === "client") return clientSessionCookie;
  return employeeSessionCookie;
}

function loginPathForWorkspace(workspace: Workspace): string {
  if (workspace === "super-admin") return "/super-admin/login";
  if (workspace === "admin") return "/admin/login";
  if (workspace === "client") return "/client/login";
  return "/employee/login";
}

export const config = {
  matcher: ["/super-admin/:path*", "/admin/:path*", "/manager/:path*", "/employee/:path*", "/client/:path*"],
};
