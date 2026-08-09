import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/finance/invoices/${encodeURIComponent(invoiceId)}/send`,
    init: { method: "POST" },
    unavailableMessage: "Invoice could not be sent.",
  });
}
