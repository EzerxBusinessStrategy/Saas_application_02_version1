import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/service-requests/${encodeURIComponent(requestId)}`,
    unavailableMessage: "Service request unavailable.",
  });
}
