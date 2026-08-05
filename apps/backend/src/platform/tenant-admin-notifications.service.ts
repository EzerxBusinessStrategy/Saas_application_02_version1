import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import {
  NotificationItemDto,
  NotificationsResponseDto,
  SuperAdminNotificationsQuery,
} from "./super-admin-notifications.dto";
import {
  TenantAdminNotificationsRepository,
  TenantNotificationRow,
} from "./tenant-admin-notifications.repository";
import { requireTenantAdminContext } from "./tenant-admin-context";

@Injectable()
export class TenantAdminNotificationsService {
  constructor(
    @Inject(TenantAdminNotificationsRepository)
    private readonly repository: TenantAdminNotificationsRepository,
  ) {}

  async list(context: RequestContext, query: SuperAdminNotificationsQuery): Promise<NotificationsResponseDto> {
    const rows = await this.repository.list(requireTenantAdminContext(context), query.status, query.limit);
    return {
      unreadCount: rows.unreadCount,
      items: rows.items.map(mapNotification),
    };
  }

  async unreadCount(context: RequestContext): Promise<number> {
    return this.repository.unreadCount(requireTenantAdminContext(context));
  }

  async markRead(context: RequestContext, notificationId: string): Promise<void> {
    await this.repository.markRead(requireTenantAdminContext(context), notificationId);
  }

  async markAllRead(context: RequestContext): Promise<void> {
    await this.repository.markAllRead(requireTenantAdminContext(context));
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
