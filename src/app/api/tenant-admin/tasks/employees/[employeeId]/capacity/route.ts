import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { params: Promise<{ employeeId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { employeeId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/employees/${encodeURIComponent(employeeId)}/capacity`,
    init: {
      method: "PATCH",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Employee capacity could not be updated.",
  });
}
