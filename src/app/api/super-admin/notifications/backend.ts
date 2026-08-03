import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function proxyBackend(request: Request, path: string, init?: RequestInit) {
  return proxySuperAdminBackend({
    path,
    init,
    unauthenticatedMessage: "Sign in to view notifications.",
    unavailableMessage: "Backend notification service is unavailable.",
  });
}
