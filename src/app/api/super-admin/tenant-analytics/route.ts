import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(request: Request) {
  return proxySuperAdminBackend({
    path: `/super-admin/tenant-analytics${new URL(request.url).search}`,
    unauthenticatedMessage: "Sign in to view tenant analytics.",
    unavailableMessage: "Tenant analytics are unavailable.",
  });
}
