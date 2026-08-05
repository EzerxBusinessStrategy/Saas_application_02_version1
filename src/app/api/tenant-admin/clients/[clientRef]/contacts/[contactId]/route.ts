import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly clientRef: string; readonly contactId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { clientRef, contactId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/clients/${encodeURIComponent(clientRef)}/contacts/${encodeURIComponent(contactId)}`,
    init: {
      method: "PATCH",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Client contact could not be updated.",
  });
}
