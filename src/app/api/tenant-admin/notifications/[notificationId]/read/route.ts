import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ notificationId: string }> },
) {
  const { notificationId } = await context.params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/notifications/${encodeURIComponent(notificationId)}/read`,
    init: { method: "PATCH" },
    unauthenticatedMessage: "Tenant Admin session required.",
    unavailableMessage: "Tenant Admin notifications service unavailable.",
  });
}
