import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/tenant-admin/employee-performance?${query}` : "/tenant-admin/employee-performance";

  return proxyTenantAdminBackend({
    path,
  });
}
