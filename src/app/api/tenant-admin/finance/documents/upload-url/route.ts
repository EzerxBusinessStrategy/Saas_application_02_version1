import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function POST(request: NextRequest) {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/finance/documents/upload-url",
    init: { method: "POST", body: await request.text(), headers: { "content-type": "application/json" } },
    unavailableMessage: "Document storage is unavailable.",
  });
}
