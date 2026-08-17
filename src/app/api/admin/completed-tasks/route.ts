import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(request: Request) {
  return proxyTenantAdminBackend({
    path: `/tenant-admin/dashboard/completed-tasks${new URL(request.url).search}`,
    unauthenticatedMessage: "Tenant Admin session required.",
    unavailableMessage: "Completed tasks list unavailable.",
  });
}
