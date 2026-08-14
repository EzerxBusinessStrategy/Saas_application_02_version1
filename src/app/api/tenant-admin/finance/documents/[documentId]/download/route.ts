import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(_: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return proxyTenantAdminBackend({ path: `/tenant-admin/finance/documents/${encodeURIComponent(documentId)}/download`, unavailableMessage: "Document download is unavailable." });
}
