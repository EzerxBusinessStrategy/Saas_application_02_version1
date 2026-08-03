import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { SuperAdminNotificationsQuery } from "./super-admin-notifications.dto";

export type NotificationRow = {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  readonly tenant_id: string | null;
  readonly action_url: string | null;
  readonly created_at: Date;
  readonly read_at: Date | null;
};

@Injectable()
export class SuperAdminNotificationsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(
    context: RequestContext,
    query: SuperAdminNotificationsQuery,
  ): Promise<{ readonly unreadCount: number; readonly items: readonly NotificationRow[] }> {
    return this.withContext(context, async (client) => {
      const unreadCount = await this.unreadCountForClient(client, context.userId);
      const items = await this.itemsForClient(client, context.userId, query);
      return { unreadCount, items };
    });
  }

  async unreadCount(context: RequestContext): Promise<number> {
    return this.withContext(context, (client) => this.unreadCountForClient(client, context.userId));
  }

  async markRead(context: RequestContext, notificationId: string): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query(
        `
          update public.notification_recipients
          set read_at = coalesce(read_at, now())
          where notification_id = $1
            and recipient_user_id = $2
        `,
        [notificationId, context.userId],
      );
    });
  }

  async markAllRead(context: RequestContext): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query(
        `
          update public.notification_recipients
          set read_at = coalesce(read_at, now())
          where recipient_user_id = $1
            and read_at is null
        `,
        [context.userId],
      );
    });
  }

  async markDelivered(userId: string, notificationId: string): Promise<void> {
    if (!this.pool) throw databaseNotConfigured();
    await this.pool.query(
      `
        update public.notification_recipients
        set delivered_at = coalesce(delivered_at, now())
        where recipient_user_id = $1
          and notification_id = $2
      `,
      [userId, notificationId],
    );
  }

  async getForDelivery(userId: string, notificationId: string): Promise<NotificationRow | null> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, { userId, isPlatformAdmin: true }, async (_tx, client) => {
      const result = await client.query<NotificationRow>(
        `
          select
            n.id,
            n.type,
            n.title,
            n.message,
            n.severity,
            n.tenant_id,
            n.action_url,
            n.created_at,
            nr.read_at
          from public.notification_recipients nr
          join public.notifications n on n.id = nr.notification_id
          where nr.recipient_user_id = $1
            and nr.notification_id = $2
        `,
        [userId, notificationId],
      );
      return result.rows[0] ?? null;
    });
  }

  private async unreadCountForClient(client: PoolClient, userId: string): Promise<number> {
    const result = await client.query<{ count: string }>(
      `
        select count(*) as count
        from public.notification_recipients
        where recipient_user_id = $1
          and read_at is null
      `,
      [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async itemsForClient(
    client: PoolClient,
    userId: string,
    query: SuperAdminNotificationsQuery,
  ): Promise<readonly NotificationRow[]> {
    const params: unknown[] = [userId];
    const conditions = ["nr.recipient_user_id = $1"];
    if (query.status === "UNREAD") conditions.push("nr.read_at is null");
    if (query.status === "READ") conditions.push("nr.read_at is not null");
    params.push(query.limit ?? 20);

    const result = await client.query<NotificationRow>(
      `
        select
          n.id,
          n.type,
          n.title,
          n.message,
          n.severity,
          n.tenant_id,
          n.action_url,
          n.created_at,
          nr.read_at
        from public.notification_recipients nr
        join public.notifications n on n.id = nr.notification_id
        where ${conditions.join(" and ")}
        order by n.created_at desc, n.id
        limit $${params.length}
      `,
      params,
    );
    return result.rows;
  }

  private async withContext<T>(
    context: RequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}
