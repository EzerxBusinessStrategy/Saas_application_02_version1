import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";

export type TenantNotificationRow = {
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
export class TenantAdminNotificationsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(
    context: RequestContext,
    status?: "ALL" | "UNREAD" | "READ",
    limit: number = 20,
  ): Promise<{ readonly unreadCount: number; readonly items: readonly TenantNotificationRow[] }> {
    return this.withContext(context, async (client) => {
      const unreadCount = await this.unreadCountForClient(client, context.userId, context.tenantId);
      const items = await this.itemsForClient(client, context.userId, context.tenantId, status, limit);
      return { unreadCount, items };
    });
  }

  async unreadCount(context: RequestContext): Promise<number> {
    return this.withContext(context, (client) =>
      this.unreadCountForClient(client, context.userId, context.tenantId),
    );
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
          update public.notification_recipients nr
          set read_at = coalesce(read_at, now())
          from public.notifications n
          where n.id = nr.notification_id
            and nr.recipient_user_id = $1
            and nr.read_at is null
            and (n.tenant_id = $2 or n.tenant_id is null)
        `,
        [context.userId, context.tenantId],
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

  private async unreadCountForClient(
    client: PoolClient,
    userId: string,
    tenantId: string | undefined,
  ): Promise<number> {
    const params: unknown[] = [userId];
    let tenantClause = "";
    if (tenantId) {
      params.push(tenantId);
      tenantClause = `and (n.tenant_id = $2 or n.tenant_id is null)`;
    }

    const result = await client.query<{ count: string }>(
      `
        select count(*) as count
        from public.notification_recipients nr
        join public.notifications n on n.id = nr.notification_id
        where nr.recipient_user_id = $1
          and nr.read_at is null
          ${tenantClause}
      `,
      params,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async itemsForClient(
    client: PoolClient,
    userId: string,
    tenantId: string | undefined,
    status?: "ALL" | "UNREAD" | "READ",
    limit: number = 20,
  ): Promise<readonly TenantNotificationRow[]> {
    const params: unknown[] = [userId];
    const conditions = ["nr.recipient_user_id = $1"];

    if (tenantId) {
      params.push(tenantId);
      conditions.push(`(n.tenant_id = $${params.length} or n.tenant_id is null)`);
    }

    if (status === "UNREAD") conditions.push("nr.read_at is null");
    if (status === "READ") conditions.push("nr.read_at is not null");

    params.push(limit);

    const result = await client.query<TenantNotificationRow>(
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
