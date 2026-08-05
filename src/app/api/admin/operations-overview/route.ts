import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET() {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/dashboard",
    unauthenticatedMessage: "Tenant Admin session required.",
    unavailableMessage: "Tenant Admin overview unavailable.",
  });
}
