import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly serviceId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { serviceId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/services/${encodeURIComponent(serviceId)}/blueprint`,
    unavailableMessage: "Service tasks could not load.",
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { serviceId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/services/${encodeURIComponent(serviceId)}/blueprint`,
    init: {
      method: "PUT",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Service tasks could not be saved.",
  });
}
