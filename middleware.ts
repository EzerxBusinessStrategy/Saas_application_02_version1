import { NextResponse, type NextRequest } from "next/server";
import { demoSessionCookie, isWorkspaceAllowed, roleFromSession } from "@/lib/demo-auth";
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
