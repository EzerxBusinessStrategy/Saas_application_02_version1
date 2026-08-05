import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function PATCH() {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/notifications/read-all",
    init: { method: "PATCH" },
    unauthenticatedMessage: "Tenant Admin session required.",
    unavailableMessage: "Tenant Admin notifications service unavailable.",
  });
}
