import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { NotificationItemDto } from "./super-admin-notifications.dto";
import {
  NotificationRow,
  SuperAdminNotificationsRepository,
} from "./super-admin-notifications.repository";
import { SuperAdminNotificationsGateway } from "./super-admin-notifications.gateway";

type NotificationPayload = {
  readonly notificationId?: string;
  readonly recipientUserId?: string;
};

@Injectable()
export class SuperAdminNotificationsListener implements OnModuleInit, OnModuleDestroy {
  private client?: PoolClient;

  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool | null,
    @Inject(SuperAdminNotificationsRepository)
    private readonly repository: SuperAdminNotificationsRepository,
    @Inject(SuperAdminNotificationsGateway)
    private readonly gateway: SuperAdminNotificationsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.pool) return;
    this.client = await this.pool.connect();
    this.client.on("notification", (message) => {
      void this.deliver(message.payload);
    });
    await this.client.query("listen super_admin_notifications");
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await this.client.query("unlisten super_admin_notifications").catch(() => undefined);
    this.client.release();
    this.client = undefined;
  }

  private async deliver(rawPayload: string | undefined): Promise<void> {
    const payload = parsePayload(rawPayload);
    if (!payload?.recipientUserId || !payload.notificationId) return;
    const row = await this.repository.getForDelivery(payload.recipientUserId, payload.notificationId);
    if (!row) return;
    this.gateway.emitNewNotification(payload.recipientUserId, mapNotification(row));
  }
}

function parsePayload(rawPayload: string | undefined): NotificationPayload | null {
  if (!rawPayload) return null;
  try {
    return JSON.parse(rawPayload) as NotificationPayload;
  } catch {
    return null;
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
