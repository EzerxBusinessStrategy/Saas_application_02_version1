import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { SuperAdminSearchQuery } from "./super-admin-search.dto";

export type SuperAdminSearchRow = {
  readonly id: string;
  readonly type: "tenant" | "user";
  readonly title: string;
  readonly subtitle: string | null;
  readonly code: string | null;
  readonly status: string;
  readonly href: string;
};

@Injectable()
export class SuperAdminSearchRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async search(context: RequestContext, query: SuperAdminSearchQuery): Promise<readonly SuperAdminSearchRow[]> {
    if (!this.pool) throw databaseNotConfigured();

    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const limit = query.limit ?? 10;
      const text = query.q?.trim() ?? "";
      if (text.length < 2) return this.recent(client, query.scope ?? "all", limit);
      return this.ranked(client, text, query.scope ?? "all", limit);
    });
  }

  private async recent(
    client: PoolClient,
    scope: NonNullable<SuperAdminSearchQuery["scope"]>,
    limit: number,
  ): Promise<readonly SuperAdminSearchRow[]> {
    const includeUsers = scope !== "tenants";
    const result = await client.query<SuperAdminSearchRow>(
      `
        select *
        from (
          select
            t.id::text as id,
            'tenant'::text as type,
            t.display_name as title,
            concat_ws(' · ', nullif(t.code, ''), nullif(t.country, ''), nullif(t.currency, '')) as subtitle,
            t.code,
            t.status,
            '/super-admin/tenants?tenantId=' || t.id::text as href,
            t.updated_at
          from public.tenants t
          union all
          select
            u.id::text as id,
            'user'::text as type,
            u.display_name as title,
            u.email_normalized as subtitle,
            null::text as code,
            u.status,
            '/super-admin/tenants?userId=' || u.id::text as href,
            u.updated_at
          from public.users u
          where $1::boolean
        ) records
        order by updated_at desc, title asc
        limit $2
      `,
      [includeUsers, limit],
    );
    return result.rows;
  }

  private async ranked(
    client: PoolClient,
    text: string,
    scope: NonNullable<SuperAdminSearchQuery["scope"]>,
    limit: number,
  ): Promise<readonly SuperAdminSearchRow[]> {
    const includeUsers = scope !== "tenants";
    const result = await client.query<SuperAdminSearchRow>(
      `
        with records as (
          select
            t.id::text as id,
            'tenant'::text as type,
            t.display_name as title,
            concat_ws(' · ', nullif(t.code, ''), nullif(t.country, ''), nullif(t.currency, '')) as subtitle,
            t.code,
            null::text as email,
            t.status,
            '/super-admin/tenants?tenantId=' || t.id::text as href,
            t.updated_at,
            coalesce(t.code, '') || ' ' || coalesce(t.legal_name, '') || ' ' || coalesce(t.display_name, '') as search_text
          from public.tenants t
          union all
          select
            u.id::text as id,
            'user'::text as type,
            u.display_name as title,
            u.email_normalized as subtitle,
            null::text as code,
            u.email_normalized as email,
            u.status,
            '/super-admin/tenants?userId=' || u.id::text as href,
            u.updated_at,
            coalesce(u.email_normalized, '') || ' ' || coalesce(u.display_name, '') as search_text
          from public.users u
          where $2::boolean
        ),
        matched as (
          select
            id,
            type,
            title,
            subtitle,
            code,
            status,
            href,
            updated_at,
            case
              when lower(coalesce(code, '')) = lower($1)
                or lower(coalesce(email, '')) = lower($1)
                or lower(title) = lower($1)
                then 1
              when lower(title) like lower($1) || '%' then 2
              when lower(title) like '%' || lower($1) || '%'
                or lower(search_text) like '%' || lower($1) || '%'
                then 3
              else 4
            end as rank_bucket,
            greatest(similarity(lower(search_text), lower($1)), similarity(lower(title), lower($1))) as similarity_score,
            ts_rank_cd(to_tsvector('simple', search_text), plainto_tsquery('simple', $1)) as text_rank
          from records
          where
            lower(coalesce(code, '')) = lower($1)
            or lower(coalesce(email, '')) = lower($1)
            or lower(title) = lower($1)
            or lower(title) like lower($1) || '%'
            or lower(search_text) like '%' || lower($1) || '%'
            or to_tsvector('simple', search_text) @@ plainto_tsquery('simple', $1)
            or lower(search_text) % lower($1)
        )
        select id, type, title, subtitle, code, status, href
        from matched
        order by rank_bucket asc, text_rank desc, similarity_score desc, updated_at desc, title asc
        limit $3
      `,
      [text, includeUsers, limit],
    );
    return result.rows;
  }
}
