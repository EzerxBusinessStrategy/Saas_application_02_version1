import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function PATCH(request: Request) {
  return proxySuperAdminBackend({
    path: "/me/profile",
    init: { method: "PATCH", headers: { "content-type": "application/json" }, body: await request.text() },
    unauthenticatedMessage: "Sign in again to update your profile.",
    unavailableMessage: "Profile service is unavailable.",
  });
}
