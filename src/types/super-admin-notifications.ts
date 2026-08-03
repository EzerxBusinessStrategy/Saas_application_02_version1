export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";

export type SuperAdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  tenantId: string | null;
  actionUrl: string | null;
  createdAt: string;
  readAt: string | null;
};

export type SuperAdminNotificationsResponse = {
  unreadCount: number;
  items: SuperAdminNotification[];
};

export type SuperAdminUnreadCountResponse = {
  unreadCount: number;
};
