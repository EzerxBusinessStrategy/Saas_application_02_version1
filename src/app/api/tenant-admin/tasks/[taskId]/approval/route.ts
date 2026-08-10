import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/${encodeURIComponent(taskId)}/approval`,
    init: {
      method: "POST",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Tenant approval could not be recorded.",
  });
}
