import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET(_: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return proxyClientPortalBackend({ path: `/client-portal/deliverables/${encodeURIComponent(documentId)}/download`, unavailableMessage: "Document download is unavailable." });
}
