import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export function GET() {
  return proxySuperAdminBackend({
    path: "/super-admin/platform-configuration",
    unauthenticatedMessage: "Sign in to view platform configuration.",
    unavailableMessage: "Platform configuration is unavailable.",
  });
}

export async function PATCH(request: Request) {
  return proxySuperAdminBackend({
    path: "/super-admin/platform-configuration",
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unauthenticatedMessage: "Sign in to update platform configuration.",
    unavailableMessage: "Platform configuration could not be saved.",
  });
}
