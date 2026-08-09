import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function POST(request: NextRequest) {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/finance/invoices/from-task",
    init: { method: "POST", body: await request.text(), headers: { "content-type": request.headers.get("content-type") ?? "application/json" } },
    unavailableMessage: "Invoice could not be created.",
  });
}
