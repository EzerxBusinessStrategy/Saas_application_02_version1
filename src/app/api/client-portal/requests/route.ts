import { NextRequest } from "next/server";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function POST(request: NextRequest) {
  return proxyClientPortalBackend({
    path: "/client-portal/requests",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unavailableMessage: "Client request could not be submitted.",
  });
}
