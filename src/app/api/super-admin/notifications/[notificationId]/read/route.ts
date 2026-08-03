import { proxyBackend } from "../../backend";

export async function PATCH(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  return proxyBackend(
    request,
    `/super-admin/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );
}
