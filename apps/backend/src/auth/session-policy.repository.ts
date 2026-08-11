import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { databaseNotConfigured, sessionExpired } from "./auth-errors";
import { RequestContext } from "./request-context";

export type SessionPolicyRow = {
  readonly remember_me: boolean;
  readonly absolute_expires_at: Date;
  readonly created: boolean;
};

export type ActiveSessionPolicy = {
  readonly auth_context_version: number;
};

@Injectable()
export class SessionPolicyRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async createOrRefresh(context: RequestContext, sessionId: string, rememberMe: boolean): Promise<SessionPolicyRow> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query<SessionPolicyRow>(
        `
        insert into public.auth_session_policies (
          user_id,
          supabase_session_id,
          remember_me,
          issued_at,
          absolute_expires_at,
          last_seen_at,
          auth_context_version
        )
        values (
          $1,
          $2,
          $3,
          now(),
          now() + interval '24 hours',
          now(),
          coalesce(
            (select max(policy.auth_context_version)
             from public.auth_session_policies policy
             where policy.user_id = $1),
            1
          )
        )
        on conflict (supabase_session_id) do update
        set remember_me = excluded.remember_me,
            last_seen_at = now()
        where public.auth_session_policies.user_id = excluded.user_id
          and public.auth_session_policies.revoked_at is null
        returning remember_me, absolute_expires_at, (xmax = 0) as created
        `,
        [context.userId, sessionId, rememberMe],
      );
      const row = result.rows[0];
      if (!row) throw sessionExpired();
      if (row.created && context.roles.includes("TENANT_ADMIN")) {
        await client.query("select private.record_tenant_administrator_session_event('login')");
      }
      return row;
    });
  }

  async assertActive(context: RequestContext, sessionId: string | undefined): Promise<ActiveSessionPolicy> {
    if (!sessionId) throw sessionExpired();
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query<ActiveSessionPolicy>(
        `
        with active_policy as materialized (
          select id, auth_context_version, last_seen_at
          from public.auth_session_policies
          where user_id = $1
            and supabase_session_id = $2
            and revoked_at is null
            and absolute_expires_at > clock_timestamp()
        ), touched as (
          update public.auth_session_policies policy
          set last_seen_at = clock_timestamp()
          from active_policy active
          where policy.id = active.id
            and (
              active.last_seen_at is null
              or active.last_seen_at <= clock_timestamp() - interval '60 seconds'
            )
          returning policy.id
        )
        select auth_context_version
        from active_policy
        `,
        [context.userId, sessionId],
      );
      const policy = result.rows[0];
      if (!policy) throw sessionExpired();
      return policy;
    });
  }

  async revoke(context: RequestContext, sessionId: string | undefined): Promise<void> {
    if (!sessionId || !this.pool) return;
    await withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query(
        `
        update public.auth_session_policies
        set revoked_at = coalesce(revoked_at, now())
        where user_id = $1
          and supabase_session_id = $2
        returning id
        `,
        [context.userId, sessionId],
      );
      if (result.rowCount && context.roles.includes("TENANT_ADMIN")) {
        await client.query("select private.record_tenant_administrator_session_event('logout')");
      }
    });
  }
}
