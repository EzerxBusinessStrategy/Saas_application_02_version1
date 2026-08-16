import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly employeeId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { employeeId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/employees/${encodeURIComponent(employeeId)}/service-capabilities`,
    unavailableMessage: "Employee services could not load.",
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { employeeId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/employees/${encodeURIComponent(employeeId)}/service-capabilities`,
    init: {
      method: "PUT",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Employee services could not be saved.",
  });
}
