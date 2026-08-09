import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import type { SuperAdminNotificationsResponse } from "@/types/super-admin-notifications";

export async function getClientPortalNotifications(): Promise<SuperAdminNotificationsResponse> {
  const response = await fetch("/api/client-portal/notifications?status=ALL&limit=20", {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Client notifications could not load.");
  return (await response.json()) as SuperAdminNotificationsResponse;
}
