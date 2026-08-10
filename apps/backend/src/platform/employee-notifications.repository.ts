import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { EmployeeRequestContext } from "./employee-context";
import { TenantNotificationRow } from "./tenant-admin-notifications.repository";

@Injectable()
export class EmployeeNotificationsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(context: EmployeeRequestContext, status?: "ALL" | "UNREAD" | "READ", limit = 20) {
    return this.withContext(context, async (client) => ({
      unreadCount: await this.unreadCountForClient(client, context.userId, context.tenantId),
      items: await this.itemsForClient(client, context.userId, context.tenantId, status, limit),
    }));
  }

  async unreadCount(context: EmployeeRequestContext): Promise<number> {
    return this.withContext(context, (client) => this.unreadCountForClient(client, context.userId, context.tenantId));
  }

  async markRead(context: EmployeeRequestContext, notificationId: string): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query(
        `
          update public.notification_recipients nr
          set read_at = coalesce(read_at, now())
          from public.notifications n
          where nr.notification_id = $1
            and n.id = nr.notification_id
            and n.tenant_id = $3
            and nr.recipient_user_id = $2
        `,
        [notificationId, context.userId, context.tenantId],
      );
    });
  }

  async markAllRead(context: EmployeeRequestContext): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query(
        `
          update public.notification_recipients nr
          set read_at = coalesce(read_at, now())
          from public.notifications n
          where n.id = nr.notification_id
            and nr.recipient_user_id = $1
            and nr.read_at is null
            and n.tenant_id = $2
        `,
        [context.userId, context.tenantId],
      );
    });
  }

  private async unreadCountForClient(client: PoolClient, userId: string, tenantId: string): Promise<number> {
    const result = await client.query<{ count: string }>(
      `
        select count(*) as count
        from public.notification_recipients nr
        join public.notifications n on n.id = nr.notification_id
        where nr.recipient_user_id = $1
          and nr.read_at is null
          and n.tenant_id = $2
      `,
      [userId, tenantId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async itemsForClient(
    client: PoolClient,
    userId: string,
    tenantId: string,
    status?: "ALL" | "UNREAD" | "READ",
    limit = 20,
  ): Promise<readonly TenantNotificationRow[]> {
    const params: unknown[] = [userId, tenantId, limit];
    const statusFilter = status === "UNREAD" ? "and nr.read_at is null" : status === "READ" ? "and nr.read_at is not null" : "";
    const result = await client.query<TenantNotificationRow>(
      `
        select n.id, n.type, n.title, n.message, n.severity, n.tenant_id, n.action_url, n.created_at, nr.read_at
        from public.notification_recipients nr
        join public.notifications n on n.id = nr.notification_id
        where nr.recipient_user_id = $1
          and n.tenant_id = $2
          ${statusFilter}
        order by n.created_at desc, n.id
        limit $3
      `,
      params,
    );
    return result.rows;
  }

  private async withContext<T>(context: EmployeeRequestContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}
