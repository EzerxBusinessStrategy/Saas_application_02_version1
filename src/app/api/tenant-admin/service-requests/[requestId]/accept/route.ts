import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/service-requests/${encodeURIComponent(requestId)}/accept`,
    init: {
      method: "POST",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Service request could not be accepted.",
  });
}
