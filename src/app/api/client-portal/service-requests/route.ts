import { type NextRequest } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET() {
  return proxyClientPortalBackend({
    path: "/client-portal/service-requests",
    unavailableMessage: "Service requests unavailable.",
  });
}

export async function POST(request: NextRequest) {
  return proxyClientPortalBackend({
    path: "/client-portal/service-requests",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unavailableMessage: "Service request could not be submitted.",
  });
}
