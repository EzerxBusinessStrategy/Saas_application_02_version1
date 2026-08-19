import { NextResponse } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";
import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

const portalKeys = ["super-admin", "tenant", "employee", "client"] as const;
type PortalKey = (typeof portalKeys)[number];

export async function POST(request: Request): Promise<NextResponse> {
  const portal = portalFrom(request);
  if (!portal) {
    return NextResponse.json({ message: "A valid portal is required." }, { status: 400 });
  }
  const body = await request.text();
  return proxyAvatar(portal, {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    body,
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const portal = portalFrom(request);
  if (!portal) {
    return NextResponse.json({ message: "A valid portal is required." }, { status: 400 });
  }
  return proxyAvatar(portal, { method: "DELETE" });
}

function portalFrom(request: Request): PortalKey | null {
  const portal = new URL(request.url).searchParams.get("portal");
  return portalKeys.includes(portal as PortalKey) ? (portal as PortalKey) : null;
}

function proxyAvatar(portal: PortalKey, init: RequestInit): Promise<NextResponse> {
  const options = {
    path: "/me/avatar",
    init,
    unauthenticatedMessage: "Sign in to update your profile photo.",
    unavailableMessage: "Profile photo updates are unavailable.",
  };

  switch (portal) {
    case "super-admin":
      return proxySuperAdminBackend(options);
    case "tenant":
      return proxyTenantAdminBackend(options);
    case "employee":
      return proxyEmployeeBackend(options);
    case "client":
      return proxyClientPortalBackend(options);
  }
}
