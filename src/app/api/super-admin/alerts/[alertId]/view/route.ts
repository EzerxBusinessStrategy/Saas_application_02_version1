import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function PATCH(_request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await params;
  return proxySuperAdminBackend({
    path: `/super-admin/alerts/${encodeURIComponent(alertId)}/view`,
    init: { method: "PATCH" },
    unauthenticatedMessage: "Sign in to update alerts.",
    unavailableMessage: "Backend alert service is unavailable.",
  });
}
