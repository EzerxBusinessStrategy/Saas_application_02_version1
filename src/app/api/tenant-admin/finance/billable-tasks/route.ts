import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET() {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/finance/billable-tasks",
    unavailableMessage: "Task billing queue unavailable.",
  });
}
