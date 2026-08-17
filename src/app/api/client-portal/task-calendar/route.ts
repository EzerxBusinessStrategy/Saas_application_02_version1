import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET(request: Request) {
  return proxyClientPortalBackend({
    path: `/client-portal/task-calendar${new URL(request.url).search}`,
    unavailableMessage: "Client task calendar unavailable.",
  });
}
