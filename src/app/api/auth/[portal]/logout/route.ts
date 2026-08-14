import { NextResponse } from "next/server";
import { logoutPortal } from "@/lib/server/portal-auth-gateway";
import type { PortalKey } from "@/lib/auth-cookies";

const portals = new Set<PortalKey>(["super-admin", "tenant", "employee", "client"]);

export async function POST(request: Request, context: { params: Promise<{ portal: string }> }): Promise<NextResponse> {
  const { portal } = await context.params;
  if (!portals.has(portal as PortalKey)) return NextResponse.json({ message: "Unknown sign-in portal." }, { status: 404 });
  return logoutPortal(portal as PortalKey, request);
}
