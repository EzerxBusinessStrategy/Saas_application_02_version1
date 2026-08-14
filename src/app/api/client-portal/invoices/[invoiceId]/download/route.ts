import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET(_: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return proxyClientPortalBackend({
    path: `/client-portal/invoices/${encodeURIComponent(invoiceId)}/download`,
    unavailableMessage: "Invoice download is unavailable.",
  });
}
