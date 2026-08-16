import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly clientRef: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientRef } = await params;
  const serviceId = request.nextUrl.searchParams.get("serviceId") ?? "";
  const query = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : "";
  return proxyTenantAdminBackend({
    path: `/tenant-admin/clients/${encodeURIComponent(clientRef)}/service-onboarding/assignees${query}`,
    unavailableMessage: "Assignable employees could not load.",
  });
}
