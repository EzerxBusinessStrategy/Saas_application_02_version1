import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  return proxySuperAdminBackend({
    path: `/super-admin/tenants/${tenantId}/invitation/cancel`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unauthenticatedMessage: "Sign in to cancel invitations.",
    unavailableMessage: "Invitation cancellation is unavailable.",
  });
}
