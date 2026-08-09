import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ workGroupId: string }> }) {
  const { workGroupId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/work-groups/${encodeURIComponent(workGroupId)}`,
    init: {
      method: "PATCH",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Work group could not be updated.",
  });
}
