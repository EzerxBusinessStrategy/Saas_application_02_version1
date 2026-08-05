import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { NotificationItemDto } from "./super-admin-notifications.dto";
import {
  TenantAdminNotificationsRepository,
  TenantNotificationRow,
} from "./tenant-admin-notifications.repository";
import { TenantAdminNotificationsGateway } from "./tenant-admin-notifications.gateway";

type TenantNotificationPayload = {
  readonly notificationId?: string;
  readonly recipientUserId?: string;
  readonly tenantId?: string;
};

@Injectable()
export class TenantAdminNotificationsListener implements OnModuleInit, OnModuleDestroy {
  private client?: PoolClient;

  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool | null,
    @Inject(TenantAdminNotificationsRepository)
    private readonly repository: TenantAdminNotificationsRepository,
    @Inject(TenantAdminNotificationsGateway)
    private readonly gateway: TenantAdminNotificationsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.pool) return;
    this.client = await this.pool.connect();
    this.client.on("notification", (message) => {
      void this.deliver(message.payload);
    });
    await this.client.query("listen tenant_admin_notifications");
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await this.client.query("unlisten tenant_admin_notifications").catch(() => undefined);
    this.client.release();
    this.client = undefined;
  }

  private async deliver(rawPayload: string | undefined): Promise<void> {
    const payload = parsePayload(rawPayload);
    if (!payload?.recipientUserId || !payload.notificationId || !payload.tenantId) return;
    const row = await this.repository.getForDelivery(
      payload.recipientUserId,
      payload.tenantId,
      payload.notificationId,
    );
    if (!row) return;
    this.gateway.emitNewNotification(payload.recipientUserId, payload.tenantId, mapNotification(row));
  }
}

function parsePayload(rawPayload: string | undefined): TenantNotificationPayload | null {
  if (!rawPayload) return null;
  try {
    return JSON.parse(rawPayload) as TenantNotificationPayload;
  } catch {
    return null;
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
