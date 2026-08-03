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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  return proxySuperAdminBackend({
    path: `/super-admin/tenants/${tenantId}/status`,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unauthenticatedMessage: "Sign in to update tenants.",
    unavailableMessage: "Tenant status could not be updated.",
  });
}
