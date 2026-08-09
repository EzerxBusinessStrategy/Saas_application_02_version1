import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

type Params = { readonly params: Promise<{ readonly clientRef: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { clientRef } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/clients/${encodeURIComponent(clientRef)}`,
    unavailableMessage: "Client unavailable.",
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { clientRef } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/clients/${encodeURIComponent(clientRef)}`,
    init: { method: "DELETE" },
    unavailableMessage: "Client could not be deleted.",
  });
}
