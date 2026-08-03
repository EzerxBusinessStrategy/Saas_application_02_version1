import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function GET(request: Request) {
  return proxySuperAdminBackend({
    path: `/super-admin/tenants${new URL(request.url).search}`,
    unauthenticatedMessage: "Sign in to view tenants.",
    unavailableMessage: "Tenant directory is unavailable.",
  });
}

export async function POST(request: Request) {
  return proxySuperAdminBackend({
    path: "/super-admin/tenants",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unauthenticatedMessage: "Sign in to create tenants.",
    unavailableMessage: "Tenant creation is unavailable.",
  });
}
