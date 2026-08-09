import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { params: Promise<{ employeeId: string }> };

export async function PATCH(_request: NextRequest, { params }: Params) {
  const { employeeId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/employees/${encodeURIComponent(employeeId)}/manager`,
    init: { method: "PATCH" },
    unavailableMessage: "Manager could not be added.",
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { employeeId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/employees/${encodeURIComponent(employeeId)}/manager`,
    init: { method: "DELETE" },
    unavailableMessage: "Manager could not be removed.",
  });
}
