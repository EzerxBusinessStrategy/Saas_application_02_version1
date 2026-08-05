import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
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

@Injectable()
export class TenantAdminNotificationsService {
  constructor(
    @Inject(TenantAdminNotificationsRepository)
    private readonly repository: TenantAdminNotificationsRepository,
  ) {}

  async list(context: RequestContext, query: SuperAdminNotificationsQuery): Promise<NotificationsResponseDto> {
    assertTenantAdminContext(context);
    const rows = await this.repository.list(context, query.status, query.limit);
    return {
      unreadCount: rows.unreadCount,
      items: rows.items.map(mapNotification),
    };
  }

  async unreadCount(context: RequestContext): Promise<number> {
    assertTenantAdminContext(context);
    return this.repository.unreadCount(context);
  }

  async markRead(context: RequestContext, notificationId: string): Promise<void> {
    assertTenantAdminContext(context);
    await this.repository.markRead(context, notificationId);
  }

  async markAllRead(context: RequestContext): Promise<void> {
    assertTenantAdminContext(context);
    await this.repository.markAllRead(context);
  }
}

function assertTenantAdminContext(context: RequestContext): void {
  if (!context.tenantId || !context.membershipId || context.isPlatformAdmin) {
    throw forbiddenPortal();
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
