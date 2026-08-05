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

export async function POST(request: NextRequest) {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/clients",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unavailableMessage: "Client could not be created.",
  });
}
