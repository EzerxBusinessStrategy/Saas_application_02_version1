import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET() {
  return proxyClientPortalBackend({
    path: "/client-portal/task-feedback/pending",
    unavailableMessage: "Pending task feedback unavailable.",
  });
}
