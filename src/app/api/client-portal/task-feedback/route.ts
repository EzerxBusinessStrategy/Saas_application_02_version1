import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";

export async function POST(request: Request) {
  return proxyClientPortalBackend({
    path: "/client-portal/task-feedback",
    init: {
      method: "POST",
      body: await request.text(),
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    },
    unavailableMessage: "Task feedback could not be submitted.",
  });
}
