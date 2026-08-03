import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(request: Request) {
  return proxySuperAdminBackend({
    path: `/super-admin/audit-log${new URL(request.url).search}`,
    unauthenticatedMessage: "Sign in to view audit logs.",
    unavailableMessage: "Backend audit log service is unavailable.",
  });
}
