import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(request: Request) {
  return proxySuperAdminBackend({
    path: `/super-admin/users/email-availability${new URL(request.url).search}`,
    unauthenticatedMessage: "Sign in to check Tenant Administrator email availability.",
    unavailableMessage: "Tenant Administrator email availability is unavailable.",
  });
}
