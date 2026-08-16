import { type NextRequest } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET(request: NextRequest) {
  return proxyClientPortalBackend({
    path: `/client-portal/service-catalogue${request.nextUrl.search}`,
    unavailableMessage: "Service catalogue unavailable.",
  });
}
