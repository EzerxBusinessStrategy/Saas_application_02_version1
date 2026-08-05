import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET() {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/tasks/options",
    unavailableMessage: "Task creation options unavailable.",
  });
}
