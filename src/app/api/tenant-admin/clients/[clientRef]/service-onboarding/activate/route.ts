import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly clientRef: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { clientRef } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/clients/${encodeURIComponent(clientRef)}/service-onboarding/activate`,
    init: {
      method: "POST",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Services could not be activated.",
  });
}
