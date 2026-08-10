import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const { notificationId } = await params;
  return proxyEmployeeBackend({
    path: `/employee/notifications/${encodeURIComponent(notificationId)}/read`,
    init: { method: "PATCH" },
    unavailableMessage: "Employee notifications service unavailable.",
  });
}
