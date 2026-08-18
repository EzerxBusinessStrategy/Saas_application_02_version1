import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import {
  NotificationItemDto,
  NotificationsResponseDto,
  SuperAdminNotificationsQuery,
} from "./super-admin-notifications.dto";
import { requireClientPortalContext } from "./client-portal-context";
import { ClientPortalNotificationsRepository } from "./client-portal-notifications.repository";
import { TenantNotificationRow } from "./tenant-admin-notifications.repository";

@Injectable()
export class ClientPortalNotificationsService {
  constructor(
    @Inject(ClientPortalNotificationsRepository)
    private readonly repository: ClientPortalNotificationsRepository,
  ) {}

  async list(context: RequestContext, query: SuperAdminNotificationsQuery): Promise<NotificationsResponseDto> {
    const rows = await this.repository.list(
      requireClientPortalContext(context),
      query.status ?? "ALL",
      query.limit ?? 20,
    );
    return {
      unreadCount: rows.unreadCount,
      items: rows.items.map(mapNotification),
    };
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
