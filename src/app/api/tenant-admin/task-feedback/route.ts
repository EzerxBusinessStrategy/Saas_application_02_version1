import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET() {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/task-feedback",
    unavailableMessage: "Feedback log unavailable.",
  });
}
