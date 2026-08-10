import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const body = await request.json().catch(() => ({}));
  return proxyEmployeeBackend({
    path: `/employee/tasks/${encodeURIComponent(taskId)}/submit`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    unavailableMessage: "Employee task submission service unavailable.",
  });
}
