import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import type { SuperAdminNotificationsResponse } from "@/types/super-admin-notifications";

export async function getClientPortalNotifications({
  status = "ALL",
  limit = 20,
}: {
  status?: "ALL" | "UNREAD" | "READ";
  limit?: number;
} = {}): Promise<SuperAdminNotificationsResponse> {
  const query = new URLSearchParams({ status, limit: String(limit) });
  const response = await fetch(`/api/client-portal/notifications?${query.toString()}`, {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Client notifications could not load.");
  return (await response.json()) as SuperAdminNotificationsResponse;
}
