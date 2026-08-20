import { NextResponse } from "next/server";
import { switchPortalContext } from "@/lib/server/portal-auth-gateway";
import type { PortalKey } from "@/lib/auth-cookies";

const portals = new Set<PortalKey>(["super-admin", "tenant", "employee", "client"]);

export async function POST(request: Request): Promise<NextResponse> {
  const portal = new URL(request.url).searchParams.get("portal");
  if (!portals.has(portal as PortalKey)) {
    return NextResponse.json({ message: "A valid portal is required." }, { status: 400 });
  }
  return switchPortalContext(portal as PortalKey, request);
}
