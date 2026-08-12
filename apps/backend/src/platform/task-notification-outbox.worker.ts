import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { NotificationItemDto } from "./super-admin-notifications.dto";
import { EmployeeNotificationsGateway } from "./employee-notifications.gateway";
import { TenantAdminNotificationsGateway } from "./tenant-admin-notifications.gateway";

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 50;
const FAILURE_RETRY_DELAY_MS = 5_000;

type OutboxEvent = {
  readonly event_id: string;
  readonly tenant_id: string;
  readonly notification_id: string;
};

type DeliveryRecipient = {
  readonly recipient_user_id: string;
  readonly notification_id: string;
  readonly notification_type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: NotificationItemDto["severity"];
  readonly tenant_id: string;
  readonly action_url: string | null;
  readonly created_at: Date;
  readonly read_at: Date | null;
};

@Injectable()
export class TaskNotificationOutboxWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TaskNotificationOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private retryAfter = 0;

  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool | null,
    @Inject(EmployeeNotificationsGateway) private readonly gateway: EmployeeNotificationsGateway,
    @Optional() @Inject(TenantAdminNotificationsGateway)
    private readonly tenantAdminGateway?: TenantAdminNotificationsGateway,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.pool) {
      this.logger.warn("[Notifications] Task notification worker is not running because the database connection is unavailable.");
      return;
    }
    this.logger.log(`[Notifications] Task notification worker is running. It checks committed notifications every ${POLL_INTERVAL_MS}ms.`);
    void this.flush();
    this.timer = setInterval(() => void this.flush(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async flush(): Promise<void> {
    if (!this.pool || this.running || Date.now() < this.retryAfter) return;
    this.running = true;
    try {
      const events = await this.pool.query<OutboxEvent>(
        "select * from private.claim_task_notification_outbox($1)",
        [BATCH_SIZE],
      );
      if (!events.rows.length) return;
      this.logger.log(`[Notifications] Worker claimed ${events.rows.length} notification event(s) for delivery.`);
      let recipients = 0;
      let connectedSockets = 0;
      for (const event of events.rows) {
        const result = await this.deliver(event);
        recipients += result.recipients;
        connectedSockets += result.connectedSockets;
      }
      this.logger.log(`[Notifications] Worker finished ${events.rows.length} event(s): ${recipients} saved recipient notification(s), ${connectedSockets} active Socket.IO connection(s) reached.`);
    } catch (error) {
      this.retryAfter = Date.now() + FAILURE_RETRY_DELAY_MS;
      this.logger.error(`[Notifications] Worker could not read the outbox. It will retry in ${FAILURE_RETRY_DELAY_MS / 1000} seconds. Confirm migration 0054_task_notification_outbox.sql is applied.`, error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async deliver(event: OutboxEvent): Promise<{ recipients: number; connectedSockets: number }> {
    if (!this.pool) return { recipients: 0, connectedSockets: 0 };
    try {
      const recipients = await this.pool.query<DeliveryRecipient>(
        "select * from private.get_task_notification_outbox_recipients($1::uuid)",
        [event.event_id],
      );
      let connectedSockets = 0;
      for (const recipient of recipients.rows) {
        const item: NotificationItemDto = {
          id: recipient.notification_id,
          type: recipient.notification_type,
          title: recipient.title,
          message: recipient.message,
          severity: recipient.severity,
          tenantId: recipient.tenant_id,
          actionUrl: recipient.action_url,
          createdAt: recipient.created_at.toISOString(),
          readAt: recipient.read_at?.toISOString() ?? null,
        };
        connectedSockets += isTenantAdminNotification(recipient.notification_type)
          ? this.tenantAdminGateway?.emitNewNotification(recipient.recipient_user_id, event.tenant_id, item) ?? 0
          : this.gateway.emitNewNotification(recipient.recipient_user_id, event.tenant_id, item);
      }
      await this.pool.query("select private.complete_task_notification_outbox($1::uuid)", [event.event_id]);
      const createdAt = recipients.rows[0]?.created_at;
      const delayMs = createdAt ? Math.max(0, Date.now() - createdAt.getTime()) : 0;
      this.logger.log(`[Notifications] Event ${event.event_id} was stored and processed in ${delayMs}ms. Recipient records: ${recipients.rows.length}; active Socket.IO connections reached: ${connectedSockets}.`);
      return { recipients: recipients.rows.length, connectedSockets };
    } catch (error) {
      try {
        await this.pool.query("select private.retry_task_notification_outbox($1::uuid)", [event.event_id]);
      } catch (retryError) {
        this.logger.error(`Unable to reschedule task notification event ${event.event_id}.`, retryError instanceof Error ? retryError.stack : undefined);
      }
      this.logger.error(`Unable to deliver task notification event ${event.event_id}.`, error instanceof Error ? error.stack : undefined);
      return { recipients: 0, connectedSockets: 0 };
    }
  }
}

function isTenantAdminNotification(type: string): boolean {
  return [
    "TASK_AWAITING_TENANT_APPROVAL",
    "TASK_SUBMITTED_FOR_TENANT_REVIEW",
    "TASK_REVIEW_CLOSED_BY_MANAGER",
    "INVOICE_READY_TO_GENERATE",
  ].includes(type);
}
