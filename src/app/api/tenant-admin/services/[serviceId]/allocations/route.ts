import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly serviceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { serviceId } = await params;
  const rateItemId = request.nextUrl.searchParams.get("rateItemId");
  const query = rateItemId ? `?rateItemId=${encodeURIComponent(rateItemId)}` : "";
  return proxyTenantAdminBackend({
    path: `/tenant-admin/services/${encodeURIComponent(serviceId)}/allocations${query}`,
    unavailableMessage: "Service task allocations could not be loaded.",
  });
}
