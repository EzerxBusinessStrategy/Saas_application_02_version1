import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(request: Request) {
  return proxySuperAdminBackend({
    path: `/super-admin/tenant-creation-options${new URL(request.url).search}`,
    unauthenticatedMessage: "Sign in to create tenants.",
    unavailableMessage: "Tenant creation options are unavailable.",
  });
}
