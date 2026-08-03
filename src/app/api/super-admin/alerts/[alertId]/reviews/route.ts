import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function POST(_request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await params;
  return proxySuperAdminBackend({
    path: `/super-admin/alerts/${encodeURIComponent(alertId)}/reviews`,
    init: { method: "POST" },
    unauthenticatedMessage: "Sign in to create reviews.",
    unavailableMessage: "Backend review service is unavailable.",
  });
}
