import type {
  SuperAdminNotificationsResponse,
  SuperAdminUnreadCountResponse,
} from "@/types/super-admin-notifications";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

export async function getSuperAdminNotifications({
  status = "ALL",
  limit = 20,
}: {
  status?: "ALL" | "UNREAD" | "READ";
  limit?: number;
} = {}): Promise<SuperAdminNotificationsResponse> {
  const query = new URLSearchParams({ status, limit: String(limit) });
  const response = await fetch(`/api/super-admin/notifications?${query.toString()}`, {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Notifications could not load.");
  return (await response.json()) as SuperAdminNotificationsResponse;
}

export async function getSuperAdminUnreadCount(): Promise<SuperAdminUnreadCountResponse> {
  const response = await fetch("/api/super-admin/notifications/unread-count", {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Unread count could not load.");
  return (await response.json()) as SuperAdminUnreadCountResponse;
}

export async function markSuperAdminNotificationRead(notificationId: string): Promise<void> {
  const response = await fetch(`/api/super-admin/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Notification could not be marked read.");
}

export async function markAllSuperAdminNotificationsRead(): Promise<void> {
  const response = await fetch("/api/super-admin/notifications/read-all", {
    method: "PATCH",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Notifications could not be marked read.");
}
