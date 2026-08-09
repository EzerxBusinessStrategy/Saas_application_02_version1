import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET() {
  return proxyClientPortalBackend({
    path: "/client-portal/requests/options",
    unavailableMessage: "Client request options unavailable.",
  });
}
