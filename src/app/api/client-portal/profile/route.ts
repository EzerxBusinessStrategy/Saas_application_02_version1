import { NextRequest } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function GET() {
  return proxyClientPortalBackend({
    path: "/client-portal/profile",
    unavailableMessage: "Client profile service unavailable.",
  });
}

export async function PATCH(request: NextRequest) {
  return proxyClientPortalBackend({
    path: "/client-portal/profile",
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unavailableMessage: "Client profile could not be saved.",
  });
}
