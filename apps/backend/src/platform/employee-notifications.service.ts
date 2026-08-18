import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireEmployeeContext } from "./employee-context";
import {
  NotificationItemDto,
  NotificationsResponseDto,
  SuperAdminNotificationsQuery,
} from "./super-admin-notifications.dto";
import { EmployeeNotificationsRepository } from "./employee-notifications.repository";
import { TenantNotificationRow } from "./tenant-admin-notifications.repository";

@Injectable()
export class EmployeeNotificationsService {
  constructor(@Inject(EmployeeNotificationsRepository) private readonly repository: EmployeeNotificationsRepository) {}

  async list(context: RequestContext, query: SuperAdminNotificationsQuery): Promise<NotificationsResponseDto> {
    const rows = await this.repository.list(
      requireEmployeeContext(context),
      query.status ?? "ALL",
      query.limit ?? 20,
    );
    return { unreadCount: rows.unreadCount, items: rows.items.map(mapNotification) };
  }

  async unreadCount(context: RequestContext): Promise<number> {
    return this.repository.unreadCount(requireEmployeeContext(context));
  }

  async markRead(context: RequestContext, notificationId: string): Promise<void> {
    await this.repository.markRead(requireEmployeeContext(context), notificationId);
  }

  async markAllRead(context: RequestContext): Promise<void> {
    await this.repository.markAllRead(requireEmployeeContext(context));
  }
}

function mapNotification(row: TenantNotificationRow): NotificationItemDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    tenantId: row.tenant_id,
    actionUrl: row.action_url,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}
