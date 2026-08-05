import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/notifications${search}`,
    unauthenticatedMessage: "Tenant Admin session required.",
    unavailableMessage: "Tenant Admin notifications service unavailable.",
  });
}
