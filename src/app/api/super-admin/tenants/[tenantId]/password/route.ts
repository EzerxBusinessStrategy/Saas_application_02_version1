import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  return proxySuperAdminBackend({
    path: `/super-admin/tenants/${tenantId}/password`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unauthenticatedMessage: "Sign in to manage tenant passwords.",
    unavailableMessage: "Tenant Administrator password could not be updated.",
  });
}
