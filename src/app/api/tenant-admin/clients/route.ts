import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return proxyTenantAdminBackend({
    path: query ? `/tenant-admin/clients?${query}` : "/tenant-admin/clients",
    unavailableMessage: "Clients unavailable.",
  });
}
