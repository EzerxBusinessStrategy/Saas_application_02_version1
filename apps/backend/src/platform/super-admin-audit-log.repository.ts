import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { AuditLogQuery } from "./super-admin-audit-log.dto";

export type AuditLogRow = {
  readonly id: string;
  readonly actor: string | null;
  readonly tenant: string | null;
  readonly action: string;
  readonly resource: string;
  readonly timestamp: Date;
  readonly ip_address: string | null;
  readonly reason: string;
  readonly reason_source: "explicit" | "auto_generated";
  readonly result: string;
  readonly detail: string | null;
};

@Injectable()
export class SuperAdminAuditLogRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(
    context: RequestContext,
    query: AuditLogQuery,
  ): Promise<{ readonly rows: readonly AuditLogRow[]; readonly totalItems: number }> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const params: unknown[] = [];
      const where = auditWhere(query, params);
      const total = await client.query<{ count: string }>(
        `select count(*) from audit.audit_events ae
         left join public.users actor on actor.id = ae.actor_user_id
         left join public.tenants tenant on tenant.id = ae.tenant_id
         where ${where}`,
        params,
      );
      const rows = await client.query<AuditLogRow>(
        `
        select
          ae.id::text,
          actor.display_name as actor,
          tenant.display_name as tenant,
          ae.action,
          ae.resource_type as resource,
          ae.created_at as timestamp,
          ae.ip_address,
          ae.reason,
          ae.reason_source,
          ae.result,
          coalesce(ae.metadata::text, '') as detail
        from audit.audit_events ae
        left join public.users actor on actor.id = ae.actor_user_id
        left join public.tenants tenant on tenant.id = ae.tenant_id
        where ${where}
        order by ${auditOrderBy(query.sort)}
        limit ${param(params, query.pageSize)}
        offset ${param(params, (query.page - 1) * query.pageSize)}
        `,
        params,
      );
      return { rows: rows.rows, totalItems: Number(total.rows[0]?.count ?? 0) };
    });
  }
}

function auditWhere(query: AuditLogQuery, params: unknown[]): string {
  const conditions = ["true"];
  if (query.tenantId) {
    const tenantId = param(params, query.tenantId);
    conditions.push(`(ae.tenant_id = ${tenantId}::uuid or (ae.resource_type = 'tenant' and ae.resource_id = ${tenantId}::uuid))`);
  }
  if (query.result) {
    const dbResult = query.result === "success" ? "succeeded" : query.result;
    conditions.push(`ae.result = ${param(params, dbResult)}`);
  }
  if (query.query) {
    const value = param(params, query.query);
    conditions.push(`(
      actor.display_name ilike '%' || ${value} || '%'
      or tenant.display_name ilike '%' || ${value} || '%'
      or ae.action ilike '%' || ${value} || '%'
      or ae.resource_type ilike '%' || ${value} || '%'
      or ae.reason ilike '%' || ${value} || '%'
    )`);
  }
  return conditions.join(" and ");
}

function auditOrderBy(sort: AuditLogQuery["sort"]): string {
  if (sort === "actor") return "actor.display_name asc nulls last, ae.created_at desc, ae.id desc";
  if (sort === "tenant") return "tenant.display_name asc nulls last, ae.created_at desc, ae.id desc";
  return "ae.created_at desc, ae.id desc";
}

function param(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}
