import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  return proxySuperAdminBackend({
    path: `/super-admin/tenants/${tenantId}`,
    unauthenticatedMessage: "Sign in to view tenants.",
    unavailableMessage: "Tenant details are unavailable.",
  });
}
