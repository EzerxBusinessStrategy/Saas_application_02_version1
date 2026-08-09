import { type NextRequest } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  return proxyClientPortalBackend({
    path: `/client-portal/deliverables/${encodeURIComponent(documentId)}/decision`,
    init: {
      method: "POST",
      body: await request.text(),
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    },
    unavailableMessage: "Client deliverable decision unavailable.",
  });
}
