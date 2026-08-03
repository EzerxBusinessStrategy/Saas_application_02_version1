import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(request: Request) {
  return proxySuperAdminBackend({
    path: `/super-admin/dashboard${new URL(request.url).search}`,
    unauthenticatedMessage: "Sign in to view the dashboard.",
    unavailableMessage: "Backend dashboard service is unavailable.",
  });
}
