import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(request: Request) {
  return proxySuperAdminBackend({
    path: `/super-admin/search${new URL(request.url).search}`,
    unauthenticatedMessage: "Sign in to search platform records.",
    unavailableMessage: "Backend search service is unavailable.",
  });
}
