import { type NextRequest } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params;
  return proxyClientPortalBackend({
    path: `/client-portal/services/${encodeURIComponent(serviceId)}/comments`,
    init: {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
      body: await request.text(),
    },
    unavailableMessage: "Service comment could not be sent.",
  });
}
