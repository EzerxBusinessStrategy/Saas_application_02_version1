import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { ClientPortalRequestContext, ClientPortalScope, resolveClientPortalScope } from "./client-portal-context";
import { TenantNotificationRow } from "./tenant-admin-notifications.repository";

const clientPortalNotificationTypes = [
  "CLIENT_TASK_CREATED",
  "CLIENT_INVOICE_SENT",
  "CLIENT_DELIVERABLE_SHARED",
] as const;

@Injectable()
export class ClientPortalNotificationsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(
    context: ClientPortalRequestContext,
    status?: "ALL" | "UNREAD" | "READ",
    limit: number = 20,
  ): Promise<{ readonly unreadCount: number; readonly items: readonly TenantNotificationRow[] }> {
    return this.withContext(context, async (client, scope) => ({
      unreadCount: await this.unreadCountForClient(client, scope),
      items: await this.itemsForClient(client, scope, status, limit),
    }));
  }

  private async unreadCountForClient(client: PoolClient, context: ClientPortalScope): Promise<number> {
    const result = await client.query<{ count: string }>(
      `
        select count(*) as count
        from public.notification_recipients nr
        join public.notifications n on n.id = nr.notification_id
        where nr.recipient_user_id = $1
          and nr.read_at is null
          and n.tenant_id = $2
          and n.type = any($3::text[])
          and n.metadata->>'clientId' = $4
      `,
      [context.userId, context.tenantId, clientPortalNotificationTypes, context.clientId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async itemsForClient(
    client: PoolClient,
    context: ClientPortalScope,
    status?: "ALL" | "UNREAD" | "READ",
    limit: number = 20,
  ): Promise<readonly TenantNotificationRow[]> {
    const params: unknown[] = [context.userId, context.tenantId, clientPortalNotificationTypes, context.clientId, limit];
    const statusSql = status === "UNREAD" ? "and nr.read_at is null" : status === "READ" ? "and nr.read_at is not null" : "";
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
        where nr.recipient_user_id = $1
          and n.tenant_id = $2
          and n.type = any($3::text[])
          and n.metadata->>'clientId' = $4
          ${statusSql}
        order by n.created_at desc, n.id
        limit $5
      `,
      params,
    );
    return result.rows;
  }

  private async withContext<T>(
    context: ClientPortalRequestContext,
    work: (client: PoolClient, scope: ClientPortalScope) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const scope = await resolveClientPortalScope(client, context);
      return work(client, scope);
    });
  }
}
