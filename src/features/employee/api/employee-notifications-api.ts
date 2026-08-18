import type { SuperAdminNotificationsResponse } from "@/types/super-admin-notifications";

export async function getEmployeeNotifications({
  status = "ALL",
  limit = 20,
}: {
  status?: "ALL" | "UNREAD" | "READ";
  limit?: number;
} = {}): Promise<SuperAdminNotificationsResponse> {
  const query = new URLSearchParams({ status, limit: String(limit) });
  const response = await fetch(`/api/employee/notifications?${query.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Employee notifications could not load.");
  return (await response.json()) as SuperAdminNotificationsResponse;
}

export async function markEmployeeNotificationRead(notificationId: string): Promise<void> {
  const response = await fetch(`/api/employee/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH" });
  if (!response.ok) throw new Error("Notification could not be marked read.");
}

export async function markAllEmployeeNotificationsRead(): Promise<void> {
  const response = await fetch("/api/employee/notifications/read-all", { method: "PATCH" });
  if (!response.ok) throw new Error("Notifications could not be marked read.");
}
