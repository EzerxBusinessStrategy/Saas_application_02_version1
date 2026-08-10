import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  return proxyEmployeeBackend({
    path: `/employee/tasks/${encodeURIComponent(taskId)}/pause`,
    init: { method: "POST" },
    unavailableMessage: "Employee task timer service unavailable.",
  });
}
