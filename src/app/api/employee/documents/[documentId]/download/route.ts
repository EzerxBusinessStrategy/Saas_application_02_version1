import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET(_: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return proxyEmployeeBackend({ path: `/employee/documents/${encodeURIComponent(documentId)}/download`, unavailableMessage: "Document download is unavailable." });
}
