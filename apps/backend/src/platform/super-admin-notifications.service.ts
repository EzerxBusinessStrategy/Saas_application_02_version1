import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import {
  NotificationItemDto,
  NotificationsResponseDto,
  SuperAdminNotificationsQuery,
} from "./super-admin-notifications.dto";
import {
  NotificationRow,
  SuperAdminNotificationsRepository,
} from "./super-admin-notifications.repository";

@Injectable()
export class SuperAdminNotificationsService {
  constructor(
    @Inject(SuperAdminNotificationsRepository)
    private readonly repository: SuperAdminNotificationsRepository,
  ) {}

  async list(context: RequestContext, query: SuperAdminNotificationsQuery): Promise<NotificationsResponseDto> {
    assertSuperAdminContext(context);
    const rows = await this.repository.list(context, query);
    return {
      unreadCount: rows.unreadCount,
      items: rows.items.map(mapNotification),
    };
  }

  async unreadCount(context: RequestContext): Promise<number> {
    assertSuperAdminContext(context);
    return this.repository.unreadCount(context);
  }

  async markRead(context: RequestContext, notificationId: string): Promise<void> {
    assertSuperAdminContext(context);
    await this.repository.markRead(context, notificationId);
  }

  async markAllRead(context: RequestContext): Promise<void> {
    assertSuperAdminContext(context);
    await this.repository.markAllRead(context);
  }
}

function assertSuperAdminContext(context: RequestContext): void {
  if (!context.isPlatformAdmin || context.tenantId || context.membershipId) {
    throw forbiddenPortal();
  }
}

function mapNotification(row: NotificationRow): NotificationItemDto {
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
