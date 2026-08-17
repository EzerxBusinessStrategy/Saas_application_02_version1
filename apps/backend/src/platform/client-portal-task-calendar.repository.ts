import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import {
  ClientPortalRequestContext,
  ClientPortalScope,
  resolveClientPortalScope,
} from "./client-portal-context";
import { ClientPortalTaskCalendarQuery } from "./client-portal-task-calendar.dto";

export type ClientPortalTaskCalendarRow = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly plannedDueAt: Date;
  readonly serviceName: string;
  readonly assignees: readonly { id: string; name: string }[];
};

@Injectable()
export class ClientPortalTaskCalendarRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(
    context: ClientPortalRequestContext,
    query: ClientPortalTaskCalendarQuery,
  ): Promise<{ readonly timezone: string; readonly tasks: readonly ClientPortalTaskCalendarRow[] }> {
    return this.withContext(context, async (client, scope) => {
      const timezone = await this.getTenantTimezone(client, scope.tenantId);
      const tasks = await this.getCalendarTasks(client, scope, query, timezone);
      return { timezone, tasks };
    });
  }

  private async getTenantTimezone(client: PoolClient, tenantId: string): Promise<string> {
    const result = await client.query<{ timezone: string }>(
      `select coalesce(nullif(trim(timezone), ''), 'UTC') as timezone from public.tenants where id = $1`,
      [tenantId],
    );
    return result.rows[0]?.timezone ?? "UTC";
  }

  private async getCalendarTasks(
    client: PoolClient,
    scope: ClientPortalScope,
    query: ClientPortalTaskCalendarQuery,
    timezone: string,
  ): Promise<readonly ClientPortalTaskCalendarRow[]> {
    const result = await client.query<{
      id: string;
      title: string;
      status: string;
      planned_due_at: Date;
      service_name: string;
      assignees: Array<{ id: string; name: string }> | null;
    }>(
      `
        select
          t.id::text,
          t.title,
          t.status,
          t.planned_due_at,
          s.name as service_name,
          coalesce(
            jsonb_agg(
              distinct jsonb_build_object(
                'id', e.id::text,
                'name', coalesce(tm.display_name, e.employee_code)
              )
            ) filter (where e.id is not null),
            '[]'::jsonb
          ) as assignees
        from public.tasks t
        join public.services s
          on s.id = t.service_id
         and s.tenant_id = t.tenant_id
        left join public.task_assignments ta
          on ta.task_id = t.id
         and ta.tenant_id = t.tenant_id
         and ta.status not in ('removed', 'cancelled')
        left join public.employees e
          on e.id = ta.employee_id
         and e.tenant_id = ta.tenant_id
        where t.tenant_id = $1
          and t.client_id = $2
          and t.status <> 'cancelled'
          and t.planned_due_at is not null
          and (t.planned_due_at at time zone $5)::date between $3::date and $4::date
        group by
          t.id,
          t.title,
          t.status,
          t.planned_due_at,
          s.name
        order by t.planned_due_at asc, t.title asc
      `,
      [scope.tenantId, scope.clientId, query.from, query.to, timezone],
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      plannedDueAt: row.planned_due_at,
      serviceName: row.service_name,
      assignees: row.assignees ?? [],
    }));
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
