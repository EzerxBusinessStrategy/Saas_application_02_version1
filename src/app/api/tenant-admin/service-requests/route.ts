import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(request: NextRequest) {
  return proxyTenantAdminBackend({
    path: `/tenant-admin/service-requests${request.nextUrl.search}`,
    unavailableMessage: "Service requests unavailable.",
  });
}
