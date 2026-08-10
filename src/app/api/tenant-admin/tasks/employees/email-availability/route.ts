import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(request: Request) {
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/employees/email-availability${new URL(request.url).search}`,
    unavailableMessage: "Employee email availability is unavailable.",
  });
}
