import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { applicationUserNotFound, databaseNotConfigured } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { SuperAdminDashboardQuery } from "./super-admin-dashboard.dto";

export type DashboardUserRow = {
  readonly id: string;
  readonly email: string;
  readonly display_name: string;
};

export type DashboardTenantRow = {
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly country: string | null;
  readonly currency_code: string | null;
  readonly tenant_status: string;
  readonly tenant_administrator_last_login_at: Date | null;
  readonly financial_year_id: string | null;
  readonly financial_year_label: string | null;
  readonly financial_year_start_date: string | null;
  readonly financial_year_end_date: string | null;
  readonly financial_years: readonly DashboardFinancialYearRow[] | null;
  readonly turnover: string;
  readonly collected: string;
  readonly outstanding: string;
  readonly invoice_count: number;
  readonly active_users: number;
  readonly health_code: string | null;
  readonly health_label: string | null;
};

export type DashboardCurrencyTotalRow = {
  readonly currency_code: string;
  readonly turnover: string;
  readonly collected: string;
  readonly outstanding: string;
};

export type DashboardPlatformStatusRow = {
  readonly total_tenants: number;
  readonly active_tenants: number;
  readonly suspended_tenants: number;
  readonly pending_tenant_reviews: number;
  readonly active_tenant_users: number;
};

export type DashboardAuditRow = {
  readonly id: string;
  readonly actor_name: string | null;
  readonly action: string;
  readonly target: string | null;
  readonly tenant_name: string | null;
  readonly result: string;
  readonly created_at: Date;
};

export type DashboardTenantReviewRow = {
  readonly id: string;
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly review_type: string;
  readonly reason: string | null;
  readonly priority: string;
  readonly due_date: string | null;
  readonly status: string;
  readonly assigned_reviewer: string | null;
};

export type DashboardPlatformAlertRow = {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: string;
  readonly tenant_id: string | null;
  readonly tenant_name: string | null;
  readonly action_url: string | null;
  readonly status: string;
  readonly created_at: Date;
};

export type DashboardTrendRow = {
  readonly tenant_id: string;
  readonly month: string;
  readonly currency_code: string | null;
  readonly turnover: string;
};

export type DashboardHealthBandRow = {
  readonly code: string;
  readonly label: string;
  readonly minimum_turnover: string;
  readonly maximum_turnover: string | null;
};

export type DashboardFinancialYearRow = {
  readonly id: string;
  readonly label: string;
  readonly start_date: string;
  readonly end_date: string;
};

export type DashboardDataRows = {
  readonly user: DashboardUserRow;
  readonly metricTenants: readonly DashboardTenantRow[];
  readonly tenantRows: readonly DashboardTenantRow[];
  readonly currencyTotals: readonly DashboardCurrencyTotalRow[];
  readonly platformStatus: DashboardPlatformStatusRow;
  readonly trend: readonly DashboardTrendRow[];
  readonly audit: readonly DashboardAuditRow[];
  readonly platformAlerts: readonly DashboardPlatformAlertRow[];
  readonly tenantReviews: readonly DashboardTenantReviewRow[];
  readonly healthBands: readonly DashboardHealthBandRow[];
  readonly financialYears: readonly DashboardFinancialYearRow[];
  readonly countries: readonly string[];
  readonly tenantStatuses: readonly string[];
};

@Injectable()
export class SuperAdminDashboardRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getDashboardRows(
    context: RequestContext,
    filters: SuperAdminDashboardQuery,
  ): Promise<DashboardDataRows> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const user = await this.getUser(client, context.userId);
      const metricTenants = await this.getTenantRows(client, filters, {
        includeSearch: false,
        includeStatus: false,
      });
      const tenantRows = await this.getTenantRows(client, filters, {
        includeSearch: true,
        includeStatus: true,
      });
      const currencyTotals = await this.getCurrencyTotals(client, filters);
      const platformStatus = await this.getPlatformStatus(client, filters);
      const trend = await this.getTrendRows(client, filters);
      const audit = await this.getAuditRows(client);
      const platformAlerts = await this.getPlatformAlerts(client, filters);
      const tenantReviews = await this.getTenantReviews(client, filters);
      const healthBands = await this.getHealthBands(client);
      const financialYears = await this.getFinancialYears(client, filters);
      const countries = await this.getCountries(client);
      const tenantStatuses = await this.getTenantStatuses(client);

      return {
        user,
        metricTenants,
        tenantRows,
        currencyTotals,
        platformStatus,
        trend,
        audit,
        platformAlerts,
        tenantReviews,
        healthBands,
        financialYears,
        countries,
        tenantStatuses,
      };
    });
  }

  private async getUser(client: PoolClient, userId: string): Promise<DashboardUserRow> {
    const result = await client.query<DashboardUserRow>(
      `
      select id::text, email, display_name
      from public.users
      where id = $1
        and status = 'active'
      `,
      [userId],
    );
    if (!result.rows[0]) throw applicationUserNotFound();
    return result.rows[0];
  }

  private async getTenantRows(
    client: PoolClient,
    filters: SuperAdminDashboardQuery,
    options: { readonly includeSearch: boolean; readonly includeStatus: boolean },
  ): Promise<readonly DashboardTenantRow[]> {
    const params: unknown[] = [];
    const financialYearWhere = selectedFinancialYearCondition(filters, params, "tfy");
    const tenantWhere = tenantConditions(filters, params, "t", options);
    const invoiceWhere = invoiceConditions(filters, params, "i", "ft");
    const healthCondition = filters.health ? `and hb.code = ${param(params, filters.health)}` : "";
    const result = await client.query<DashboardTenantRow>(
      `
      with filtered_tenants as (
        select
          t.id,
          t.display_name,
          t.country,
          t.currency,
          t.status,
          fy.id as financial_year_id,
          fy.label as financial_year_label,
          fy.start_date as financial_year_start_date,
          fy.end_date as financial_year_end_date
        from public.tenants t
        left join lateral (
          select tfy.id, tfy.label, tfy.start_date, tfy.end_date
          from public.tenant_financial_years tfy
          where tfy.tenant_id = t.id
            and ${financialYearWhere}
          order by tfy.end_date desc, tfy.start_date desc
          limit 1
        ) fy on true
        where ${tenantWhere}
      ),
      financial_year_options as (
        select
          tfy.tenant_id,
          jsonb_agg(
            jsonb_build_object(
              'id', tfy.id::text,
              'label', tfy.label,
              'start_date', tfy.start_date::text,
              'end_date', tfy.end_date::text
            )
            order by tfy.start_date desc, tfy.end_date desc
          ) as financial_years
        from public.tenant_financial_years tfy
        join filtered_tenants ft on ft.id = tfy.tenant_id
        group by tfy.tenant_id
      ),
      item_totals as (
        select
          ii.tenant_id,
          ii.invoice_id,
          sum(ii.gross_amount - ii.discount_amount)::numeric(18,2) as turnover_amount
        from public.invoice_items ii
        join filtered_tenants ft on ft.id = ii.tenant_id
        group by ii.tenant_id, ii.invoice_id
      ),
      payment_totals as (
        select
          p.tenant_id,
          p.invoice_id,
          coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric(18,2) as collected_amount
        from public.payments p
        join filtered_tenants ft on ft.id = p.tenant_id
        group by p.tenant_id, p.invoice_id
      ),
      invoice_values as (
        select
          i.tenant_id,
          i.id,
          i.currency_code,
          coalesce(
            it.turnover_amount,
            greatest(i.subtotal_amount - i.discount_amount, 0),
            0
          )::numeric(18,2) as turnover_amount,
          coalesce(pt.collected_amount, 0)::numeric(18,2) as collected_amount
        from public.invoices i
        join filtered_tenants ft on ft.id = i.tenant_id
        left join item_totals it on it.tenant_id = i.tenant_id and it.invoice_id = i.id
        left join payment_totals pt on pt.tenant_id = i.tenant_id and pt.invoice_id = i.id
        where ${invoiceWhere}
      ),
      tenant_finance as (
        select
          tenant_id,
          max(currency_code) as invoice_currency_code,
          sum(turnover_amount)::numeric(18,2) as turnover,
          sum(collected_amount)::numeric(18,2) as collected,
          sum(greatest(turnover_amount - collected_amount, 0))::numeric(18,2) as outstanding,
          count(id)::integer as invoice_count
        from invoice_values
        group by tenant_id
      ),
      active_users as (
        select tenant_id, count(*)::integer as active_users
        from public.tenant_memberships
        where status = 'active'
        group by tenant_id
      ),
      tenant_administrator_logins as (
        select
          tm.tenant_id,
          max(greatest(c.last_login_at, u.last_login_at, tm.last_access_at, s.last_seen_at)) as last_login_at
        from filtered_tenants ft
        join public.tenant_memberships tm on tm.tenant_id = ft.id and tm.status = 'active'
        join public.users u on u.id = tm.user_id
        join public.membership_roles mr on mr.tenant_id = tm.tenant_id and mr.membership_id = tm.id and mr.status = 'active'
        join public.roles r on r.id = mr.role_id and r.code = 'TENANT_ADMIN'
        left join authn.credentials c on c.user_id = tm.user_id
        left join authn.sessions s
          on s.user_id = tm.user_id
         and (s.tenant_id = tm.tenant_id or s.tenant_id is null)
        group by tm.tenant_id
      )
      select
        ft.id::text as tenant_id,
        ft.display_name as tenant_name,
        ft.country,
        coalesce(ft.currency, tf.invoice_currency_code) as currency_code,
        ft.status as tenant_status,
        tal.last_login_at as tenant_administrator_last_login_at,
        ft.financial_year_id::text,
        ft.financial_year_label,
        ft.financial_year_start_date::text,
        ft.financial_year_end_date::text,
        coalesce(fyo.financial_years, '[]'::jsonb) as financial_years,
        coalesce(tf.turnover, 0)::numeric(18,2) as turnover,
        coalesce(tf.collected, 0)::numeric(18,2) as collected,
        coalesce(tf.outstanding, 0)::numeric(18,2) as outstanding,
        coalesce(tf.invoice_count, 0)::integer as invoice_count,
        coalesce(au.active_users, 0)::integer as active_users,
        hb.code as health_code,
        hb.label as health_label
      from filtered_tenants ft
      left join tenant_finance tf on tf.tenant_id = ft.id
      left join active_users au on au.tenant_id = ft.id
      left join tenant_administrator_logins tal on tal.tenant_id = ft.id
      left join financial_year_options fyo on fyo.tenant_id = ft.id
      left join lateral (
        select code, label
        from public.tenant_health_bands
        where is_active
          and coalesce(tf.turnover, 0) >= minimum_turnover
          and (maximum_turnover is null or coalesce(tf.turnover, 0) < maximum_turnover)
        order by sort_order
        limit 1
      ) hb on true
      where true ${healthCondition}
      order by coalesce(tf.turnover, 0) desc, ft.display_name asc
      limit 100
      `,
      params,
    );
    return result.rows;
  }

  private async getCurrencyTotals(
    client: PoolClient,
    filters: SuperAdminDashboardQuery,
  ): Promise<readonly DashboardCurrencyTotalRow[]> {
    const params: unknown[] = [];
    const financialYearWhere = selectedFinancialYearCondition(filters, params, "tfy");
    const tenantWhere = tenantConditions(filters, params, "t", {
      includeSearch: false,
      includeStatus: false,
    });
    const invoiceWhere = invoiceConditions(filters, params, "i", "ft");
    const result = await client.query<DashboardCurrencyTotalRow>(
      `
      with filtered_tenants as (
        select t.id, fy.id as financial_year_id
        from public.tenants t
        left join lateral (
          select tfy.id
          from public.tenant_financial_years tfy
          where tfy.tenant_id = t.id
            and ${financialYearWhere}
          order by tfy.end_date desc, tfy.start_date desc
          limit 1
        ) fy on true
        where ${tenantWhere}
      ),
      item_totals as (
        select
          ii.tenant_id,
          ii.invoice_id,
          sum(ii.gross_amount - ii.discount_amount)::numeric(18,2) as turnover_amount
        from public.invoice_items ii
        join filtered_tenants ft on ft.id = ii.tenant_id
        group by ii.tenant_id, ii.invoice_id
      ),
      payment_totals as (
        select
          p.tenant_id,
          p.invoice_id,
          coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric(18,2) as collected_amount
        from public.payments p
        join filtered_tenants ft on ft.id = p.tenant_id
        group by p.tenant_id, p.invoice_id
      ),
      invoice_values as (
        select
          i.currency_code,
          coalesce(it.turnover_amount, greatest(i.subtotal_amount - i.discount_amount, 0), 0)::numeric(18,2) as turnover_amount,
          coalesce(pt.collected_amount, 0)::numeric(18,2) as collected_amount
        from public.invoices i
        join filtered_tenants ft on ft.id = i.tenant_id
        left join item_totals it on it.tenant_id = i.tenant_id and it.invoice_id = i.id
        left join payment_totals pt on pt.tenant_id = i.tenant_id and pt.invoice_id = i.id
        where ${invoiceWhere}
      )
      select
        currency_code,
        sum(turnover_amount)::numeric(18,2) as turnover,
        sum(collected_amount)::numeric(18,2) as collected,
        sum(greatest(turnover_amount - collected_amount, 0))::numeric(18,2) as outstanding
      from invoice_values
      group by currency_code
      order by currency_code
      `,
      params,
    );
    return result.rows;
  }

  private async getPlatformStatus(
    client: PoolClient,
    filters: SuperAdminDashboardQuery,
  ): Promise<DashboardPlatformStatusRow> {
    const params: unknown[] = [];
    const tenantWhere = tenantConditions(filters, params, "t", {
      includeSearch: false,
      includeStatus: false,
    });
    const result = await client.query<DashboardPlatformStatusRow>(
      `
      with filtered_tenants as (
        select t.id, t.status
        from public.tenants t
        where ${tenantWhere}
      )
      select
        count(*)::integer as total_tenants,
        count(*) filter (where status = 'active')::integer as active_tenants,
        count(*) filter (where status = 'suspended')::integer as suspended_tenants,
        (
          select count(*)::integer
          from public.tenant_reviews tr
          join filtered_tenants ft on ft.id = tr.tenant_id
          where tr.status in ('pending', 'in_progress', 'overdue')
        ) as pending_tenant_reviews,
        (
          select count(distinct u.id)::integer
          from public.users u
          join public.tenant_memberships tm on tm.user_id = u.id
          join filtered_tenants ft on ft.id = tm.tenant_id
          where u.status = 'active'
            and tm.status = 'active'
        ) as active_tenant_users
      from filtered_tenants
      `,
      params,
    );
    return (
      result.rows[0] ?? {
        total_tenants: 0,
        active_tenants: 0,
        suspended_tenants: 0,
        pending_tenant_reviews: 0,
        active_tenant_users: 0,
      }
    );
  }

  private async getTrendRows(
    client: PoolClient,
    filters: SuperAdminDashboardQuery,
  ): Promise<readonly DashboardTrendRow[]> {
    const params: unknown[] = [];
    const financialYearWhere = selectedFinancialYearCondition(filters, params, "tfy");
    const tenantWhere = tenantConditions(filters, params, "t", {
      includeSearch: true,
      includeStatus: true,
    });
    const invoiceWhere = invoiceConditions(filters, params, "i", "ft");
    const result = await client.query<DashboardTrendRow>(
      `
      with filtered_tenants as (
        select t.id, t.currency, fy.id as financial_year_id
        from public.tenants t
        left join lateral (
          select tfy.id
          from public.tenant_financial_years tfy
          where tfy.tenant_id = t.id
            and ${financialYearWhere}
          order by tfy.end_date desc, tfy.start_date desc
          limit 1
        ) fy on true
        where ${tenantWhere}
      ),
      item_totals as (
        select
          ii.tenant_id,
          ii.invoice_id,
          sum(ii.gross_amount - ii.discount_amount)::numeric(18,2) as turnover_amount
        from public.invoice_items ii
        join filtered_tenants ft on ft.id = ii.tenant_id
        group by ii.tenant_id, ii.invoice_id
      )
      select
        i.tenant_id::text as tenant_id,
        to_char(date_trunc('month', i.finalized_at), 'Mon YYYY') as month,
        coalesce(ft.currency, i.currency_code) as currency_code,
        sum(coalesce(it.turnover_amount, greatest(i.subtotal_amount - i.discount_amount, 0), 0))::numeric(18,2) as turnover
      from public.invoices i
      join filtered_tenants ft on ft.id = i.tenant_id
      left join item_totals it on it.tenant_id = i.tenant_id and it.invoice_id = i.id
      where ${invoiceWhere}
      group by i.tenant_id, date_trunc('month', i.finalized_at), coalesce(ft.currency, i.currency_code)
      order by date_trunc('month', i.finalized_at)
      limit 1200
      `,
      params,
    );
    return result.rows;
  }

  private async getAuditRows(client: PoolClient): Promise<readonly DashboardAuditRow[]> {
    const result = await client.query<DashboardAuditRow>(`
      select
        ae.id::text,
        actor.display_name as actor_name,
        ae.action,
        ae.resource_type as target,
        tenant.display_name as tenant_name,
        ae.result,
        ae.created_at
      from audit.audit_events ae
      left join public.users actor on actor.id = ae.actor_user_id
      left join public.tenants tenant on tenant.id = ae.tenant_id
      order by ae.created_at desc, ae.id desc
      limit 5
    `);
    return result.rows;
  }

  private async getPlatformAlerts(
    client: PoolClient,
    filters: SuperAdminDashboardQuery,
  ): Promise<readonly DashboardPlatformAlertRow[]> {
    const params: unknown[] = [];
    const conditions = ["pa.status in ('open', 'viewed')"];
    if (filters.country) {
      conditions.push(`t.country = ${param(params, filters.country)}`);
    }
    const result = await client.query<DashboardPlatformAlertRow>(
      `
      select
        pa.id::text,
        pa.type,
        pa.title,
        pa.message,
        pa.severity,
        pa.tenant_id::text,
        t.display_name as tenant_name,
        pa.action_url,
        pa.status,
        pa.created_at
      from public.platform_alerts pa
      left join public.tenants t on t.id = pa.tenant_id
      where ${conditions.join(" and ")}
      order by
        case pa.severity when 'CRITICAL' then 1 when 'WARNING' then 2 else 3 end,
        pa.created_at desc,
        pa.id desc
      limit 10
      `,
      params,
    );
    return result.rows;
  }

  private async getTenantReviews(
    client: PoolClient,
    filters: SuperAdminDashboardQuery,
  ): Promise<readonly DashboardTenantReviewRow[]> {
    const params: unknown[] = [];
    const tenantWhere = tenantConditions(filters, params, "t", {
      includeSearch: false,
      includeStatus: false,
    });
    const result = await client.query<DashboardTenantReviewRow>(
      `
      select
        tr.id::text,
        tr.tenant_id::text,
        t.display_name as tenant_name,
        tr.review_type,
        tr.reason,
        tr.priority,
        tr.due_date::text,
        tr.status,
        reviewer.display_name as assigned_reviewer
      from public.tenant_reviews tr
      join public.tenants t on t.id = tr.tenant_id
      left join public.users reviewer on reviewer.id = tr.assigned_user_id
      where tr.status in ('pending', 'in_progress', 'overdue')
        and ${tenantWhere}
      order by tr.due_date asc nulls last, tr.created_at desc, tr.id desc
      limit 5
      `,
      params,
    );
    return result.rows;
  }

  async markAlertViewed(context: RequestContext, alertId: string): Promise<boolean> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query(
        `
        update public.platform_alerts
        set status = case when status = 'open' then 'viewed' else status end,
            viewed_at = coalesce(viewed_at, now()),
            viewed_by_user_id = coalesce(viewed_by_user_id, $2),
            updated_at = now()
        where id = $1
          and status in ('open', 'viewed')
        returning id
        `,
        [alertId, context.userId],
      );
      if (result.rowCount === 1) {
        await client.query(
          "select audit.write_audit_event('PLATFORM_ALERT_VIEWED', 'platform_alert', $1::uuid, 'succeeded')",
          [alertId],
        );
      }
      return result.rowCount === 1;
    });
  }

  async createReviewFromAlert(context: RequestContext, alertId: string): Promise<string | null> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const alert = await client.query<{
        id: string;
        type: string;
        title: string;
        message: string;
        severity: string;
        tenant_id: string | null;
      }>(
        `
        select id::text, type, title, message, severity, tenant_id::text
        from public.platform_alerts
        where id = $1
          and status in ('open', 'viewed')
        `,
        [alertId],
      );
      const row = alert.rows[0];
      if (!row?.tenant_id) return null;
      const review = await client.query<{ id: string }>(
        `
        insert into public.tenant_reviews (
          tenant_id,
          review_type,
          status,
          due_date,
          reason,
          priority,
          assigned_user_id,
          last_action_by_user_id
        )
        values (
          $1,
          $2,
          'pending',
          current_date + interval '7 days',
          $3,
          $4,
          $5,
          $5
        )
        returning id::text
        `,
        [
          row.tenant_id,
          reviewTypeFromAlert(row.type),
          row.message,
          row.severity === "CRITICAL" ? "critical" : "high",
          context.userId,
        ],
      );
      await client.query(
        `
        update public.platform_alerts
        set status = case when status = 'open' then 'viewed' else status end,
            viewed_at = coalesce(viewed_at, now()),
            viewed_by_user_id = coalesce(viewed_by_user_id, $2),
            updated_at = now()
        where id = $1
        `,
        [alertId, context.userId],
      );
      await client.query(
        "select audit.write_audit_event('TENANT_REVIEW_CREATED', 'tenant_review', $1::uuid, 'succeeded')",
        [review.rows[0]?.id],
      );
      return review.rows[0]?.id ?? null;
    });
  }

  async updateReviewStatus(
    context: RequestContext,
    reviewId: string,
    input: { readonly status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; readonly internalNotes?: string; readonly resolution?: string },
  ): Promise<boolean> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const status = input.status.toLowerCase();
      const result = await client.query(
        `
        update public.tenant_reviews
        set status = $2,
            started_at = case when $2 = 'in_progress' then coalesce(started_at, now()) else started_at end,
            completed_at = case when $2 = 'completed' then now() else completed_at end,
            internal_notes = coalesce($3, internal_notes),
            resolution = coalesce($4, resolution),
            last_action_by_user_id = $5,
            updated_at = now()
        where id = $1
          and status in ('pending', 'in_progress', 'overdue')
        returning id
        `,
        [reviewId, status, input.internalNotes ?? null, input.resolution ?? null, context.userId],
      );
      if (result.rowCount === 1) {
        await client.query(
          "select audit.write_audit_event($2, 'tenant_review', $1::uuid, 'succeeded')",
          [reviewId, status === "completed" ? "TENANT_REVIEW_COMPLETED" : status === "cancelled" ? "TENANT_REVIEW_CANCELLED" : "TENANT_REVIEW_STARTED"],
        );
      }
      return result.rowCount === 1;
    });
  }

  private async getHealthBands(client: PoolClient): Promise<readonly DashboardHealthBandRow[]> {
    const result = await client.query<DashboardHealthBandRow>(`
      select code, label, minimum_turnover, maximum_turnover
      from public.tenant_health_bands
      where is_active
      order by sort_order
    `);
    return result.rows;
  }

  private async getFinancialYears(
    client: PoolClient,
    filters: SuperAdminDashboardQuery,
  ): Promise<readonly DashboardFinancialYearRow[]> {
    const params: unknown[] = [];
    const tenantWhere = tenantConditions(filters, params, "t", {
      includeSearch: false,
      includeStatus: false,
    });
    const result = await client.query<DashboardFinancialYearRow>(
      `
      select distinct
        tfy.id::text,
        tfy.label,
        tfy.start_date::text,
        tfy.end_date::text
      from public.tenant_financial_years tfy
      join public.tenants t on t.id = tfy.tenant_id
      where ${tenantWhere}
      order by start_date desc, label asc
      limit 20
      `,
      params,
    );
    return result.rows;
  }

  private async getCountries(client: PoolClient): Promise<readonly string[]> {
    const result = await client.query<{ country: string }>(`
      select distinct country
      from public.tenants
      where country is not null
      order by country
    `);
    const countries = result.rows.map((row) => row.country);
    return countries.length ? countries : COUNTRY_CODES;
  }

  private async getTenantStatuses(client: PoolClient): Promise<readonly string[]> {
    const result = await client.query<{ status: string }>(`
      select distinct status
      from public.tenants
      order by status
    `);
    const statuses = result.rows.map((row) => row.status);
    return statuses.length ? statuses : TENANT_STATUS_OPTIONS;
  }
}

function tenantConditions(
  filters: SuperAdminDashboardQuery,
  params: unknown[],
  alias: string,
  options: { readonly includeSearch: boolean; readonly includeStatus: boolean },
): string {
  const conditions = ["true"];
  if (filters.country) {
    conditions.push(`${alias}.country = ${param(params, filters.country)}`);
  }
  if (options.includeStatus && filters.tenantStatus) {
    conditions.push(`${alias}.status = ${param(params, filters.tenantStatus)}`);
  }
  if (options.includeSearch && filters.search) {
    const value = param(params, filters.search);
    conditions.push(`(${alias}.display_name ilike '%' || ${value} || '%' or ${alias}.code ilike '%' || ${value} || '%')`);
  }
  return conditions.join(" and ");
}

function invoiceConditions(
  filters: SuperAdminDashboardQuery,
  params: unknown[],
  alias: string,
  tenantAlias: string,
): string {
  const conditions = [
    `${alias}.status in ('issued', 'finalized', 'partially_paid', 'paid', 'overdue')`,
    `${alias}.finalized_at is not null`,
  ];
  const periodMode = filters.periodMode ?? "CURRENT_FY";
  if (periodMode !== "CUSTOM_RANGE" || filters.financialYearId) {
    conditions.push(`${tenantAlias}.financial_year_id is not null`);
    conditions.push(`${alias}.financial_year_id = ${tenantAlias}.financial_year_id`);
  }
  if (filters.from) {
    conditions.push(`${alias}.finalized_at >= ${param(params, filters.from)}::date`);
  }
  if (filters.to) {
    conditions.push(`${alias}.finalized_at < (${param(params, filters.to)}::date + interval '1 day')`);
  }
  if (filters.financialYearId) {
    const value = param(params, filters.financialYearId);
    conditions.push(`
      exists (
        select 1
        from public.tenant_financial_years tfy
        where tfy.tenant_id = ${alias}.tenant_id
          and tfy.id = ${alias}.financial_year_id
          and (
            tfy.id::text = ${value}
            or tfy.label = ${value}
            or trim(both '-' from lower(regexp_replace(tfy.label, '[^a-zA-Z0-9]+', '-', 'g'))) = lower(${value})
          )
      )
    `);
  }
  return conditions.join(" and ");
}

function selectedFinancialYearCondition(
  filters: SuperAdminDashboardQuery,
  params: unknown[],
  alias: string,
): string {
  if (filters.financialYearId) {
    const value = param(params, filters.financialYearId);
    return `(
      ${alias}.id::text = ${value}
      or ${alias}.label = ${value}
      or trim(both '-' from lower(regexp_replace(${alias}.label, '[^a-zA-Z0-9]+', '-', 'g'))) = lower(${value})
    )`;
  }
  const periodMode = filters.periodMode ?? "CURRENT_FY";
  if (periodMode === "PREVIOUS_FY") {
    return `${alias}.end_date < current_date`;
  }
  if (periodMode === "CUSTOM_RANGE") {
    return "false";
  }
  return `current_date between ${alias}.start_date and ${alias}.end_date`;
}

function param(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function reviewTypeFromAlert(type: string): string {
  if (type === "FINANCIAL_YEAR_MISSING") return "FINANCIAL_YEAR_REVIEW";
  if (type === "TENANT_SUSPENDED") return "STATUS_REVIEW";
  return "FINANCIAL_REVIEW";
}

const COUNTRY_CODES = [
  "IN",
  "AF",
  "AX",
  "AL",
  "DZ",
  "AS",
  "AD",
  "AO",
  "AI",
  "AQ",
  "AG",
  "AR",
  "AM",
  "AW",
  "AU",
  "AT",
  "AZ",
  "BS",
  "BH",
  "BD",
  "BB",
  "BY",
  "BE",
  "BZ",
  "BJ",
  "BM",
  "BT",
  "BO",
  "BQ",
  "BA",
  "BW",
  "BV",
  "BR",
  "IO",
  "BN",
  "BG",
  "BF",
  "BI",
  "CV",
  "KH",
  "CM",
  "CA",
  "KY",
  "CF",
  "TD",
  "CL",
  "CN",
  "CX",
  "CC",
  "CO",
  "KM",
  "CG",
  "CD",
  "CK",
  "CR",
  "CI",
  "HR",
  "CU",
  "CW",
  "CY",
  "CZ",
  "DK",
  "DJ",
  "DM",
  "DO",
  "EC",
  "EG",
  "SV",
  "GQ",
  "ER",
  "EE",
  "SZ",
  "ET",
  "FK",
  "FO",
  "FJ",
  "FI",
  "FR",
  "GF",
  "PF",
  "TF",
  "GA",
  "GM",
  "GE",
  "DE",
  "GH",
  "GI",
  "GR",
  "GL",
  "GD",
  "GP",
  "GU",
  "GT",
  "GG",
  "GN",
  "GW",
  "GY",
  "HT",
  "HM",
  "VA",
  "HN",
  "HK",
  "HU",
  "IS",
  "ID",
  "IR",
  "IQ",
  "IE",
  "IM",
  "IL",
  "IT",
  "JM",
  "JP",
  "JE",
  "JO",
  "KZ",
  "KE",
  "KI",
  "KP",
  "KR",
  "KW",
  "KG",
  "LA",
  "LV",
  "LB",
  "LS",
  "LR",
  "LY",
  "LI",
  "LT",
  "LU",
  "MO",
  "MG",
  "MW",
  "MY",
  "MV",
  "ML",
  "MT",
  "MH",
  "MQ",
  "MR",
  "MU",
  "YT",
  "MX",
  "FM",
  "MD",
  "MC",
  "MN",
  "ME",
  "MS",
  "MA",
  "MZ",
  "MM",
  "NA",
  "NR",
  "NP",
  "NL",
  "NC",
  "NZ",
  "NI",
  "NE",
  "NG",
  "NU",
  "NF",
  "MK",
  "MP",
  "NO",
  "OM",
  "PK",
  "PW",
  "PS",
  "PA",
  "PG",
  "PY",
  "PE",
  "PH",
  "PN",
  "PL",
  "PT",
  "PR",
  "QA",
  "RE",
  "RO",
  "RU",
  "RW",
  "BL",
  "SH",
  "KN",
  "LC",
  "MF",
  "PM",
  "VC",
  "WS",
  "SM",
  "ST",
  "SA",
  "SN",
  "RS",
  "SC",
  "SL",
  "SG",
  "SX",
  "SK",
  "SI",
  "SB",
  "SO",
  "ZA",
  "GS",
  "SS",
  "ES",
  "LK",
  "SD",
  "SR",
  "SJ",
  "SE",
  "CH",
  "SY",
  "TW",
  "TJ",
  "TZ",
  "TH",
  "TL",
  "TG",
  "TK",
  "TO",
  "TT",
  "TN",
  "TR",
  "TM",
  "TC",
  "TV",
  "UG",
  "UA",
  "AE",
  "GB",
  "US",
  "UM",
  "UY",
  "UZ",
  "VU",
  "VE",
  "VN",
  "VG",
  "VI",
  "WF",
  "EH",
  "YE",
  "ZM",
  "ZW",
] as const;

const TENANT_STATUS_OPTIONS = ["active", "suspended", "archived", "provisioning"] as const;
