import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly serviceId: string; readonly rateItemId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { serviceId, rateItemId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/services/${encodeURIComponent(serviceId)}/rate-items/${encodeURIComponent(rateItemId)}/status`,
    init: {
      method: "PATCH",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "The service task status could not be updated.",
  });
}
