import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET() {
  return proxyTenantAdminBackend({ path: "/tenant-admin/dashboard/profile" });
}

export async function PATCH(request: NextRequest) {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/dashboard/profile",
    init: {
      method: "PATCH",
      body: await request.text(),
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    },
    unavailableMessage: "Tenant profile could not be updated.",
  });
}
