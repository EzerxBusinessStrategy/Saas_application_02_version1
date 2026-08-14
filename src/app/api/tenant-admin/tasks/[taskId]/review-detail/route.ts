import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/${encodeURIComponent(taskId)}/review-detail`,
    unavailableMessage: "Task review details are unavailable.",
  });
}
