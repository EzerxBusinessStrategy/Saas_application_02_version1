import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET() {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/finance/billing-groups",
    unavailableMessage: "Billing queue unavailable.",
  });
}
