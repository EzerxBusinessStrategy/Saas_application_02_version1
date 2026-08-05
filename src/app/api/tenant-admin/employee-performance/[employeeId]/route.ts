import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const { employeeId } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query
    ? `/tenant-admin/employee-performance/${employeeId}?${query}`
    : `/tenant-admin/employee-performance/${employeeId}`;

  return proxyTenantAdminBackend({
    path,
  });
}
