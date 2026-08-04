import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET() {
  return proxySuperAdminBackend({
    path: "/super-admin/tenant-list-filters",
    unauthenticatedMessage: "Sign in to view tenant filters.",
    unavailableMessage: "Tenant filters are unavailable.",
  });
}
