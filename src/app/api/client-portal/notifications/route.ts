import { type NextRequest } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET(request: NextRequest) {
  return proxyClientPortalBackend({
    path: `/client-portal/notifications${request.nextUrl.search}`,
    unavailableMessage: "Client portal notifications service unavailable.",
  });
}
