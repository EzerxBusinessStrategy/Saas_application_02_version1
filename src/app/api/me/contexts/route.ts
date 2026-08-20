import { NextResponse } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";
import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

const portalKeys = ["super-admin", "tenant", "employee", "client"] as const;
type PortalKey = (typeof portalKeys)[number];

export async function GET(request: Request): Promise<NextResponse> {
  const portal = new URL(request.url).searchParams.get("portal");
  if (!portalKeys.includes(portal as PortalKey)) {
    return NextResponse.json({ message: "A valid portal is required." }, { status: 400 });
  }

  const options = {
    path: "/me/contexts",
    unauthenticatedMessage: "Sign in to view your workspaces.",
    unavailableMessage: "Workspace details are unavailable.",
  };

  switch (portal as PortalKey) {
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
