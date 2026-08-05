import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";

export type TenantInfoResult = {
  readonly id: string;
  readonly name: string;
  readonly currencyCode: string;
};

export type FinancialYearInfoResult = {
  readonly id: string;
  readonly label: string;
  readonly startsOn: string;
  readonly endsOn: string;
};

export type DashboardMetricsResult = {
  readonly activeClients: number;
  readonly totalSalesAmount: string | null;
  readonly collectedAmount: string | null;
  readonly outstandingAmount: string | null;
  readonly currencyCode: string;
  readonly openTasks: number;
  readonly overdueTasks: number;
};

export type RecentActivityResult = {
  readonly action: string;
  readonly actor: string;
  readonly createdAt: Date;
};

export type TenantAdminDashboardData = {
  readonly tenant: TenantInfoResult;
  readonly financialYear: FinancialYearInfoResult | null;
  readonly metrics: DashboardMetricsResult;
  readonly recentActivity: readonly RecentActivityResult[];
};

@Injectable()
export class TenantAdminDashboardRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getDashboardData(context: TenantAdminRequestContext): Promise<TenantAdminDashboardData> {
    if (!this.pool) throw databaseNotConfigured();

    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const tenantId = context.tenantId;
      await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);

      const tenant = await this.getTenantInfo(client, tenantId);
      const financialYear = await this.getCurrentFinancialYear(client, tenantId);
      const metrics = await this.getMetrics(client, tenantId, financialYear?.id, tenant.currencyCode);
      const recentActivity = await this.getRecentActivity(client, tenantId);

      return {
        tenant,
        financialYear,
        metrics,
        recentActivity,
      };
    });
  }

  private async getTenantInfo(client: PoolClient, tenantId: string): Promise<TenantInfoResult> {
    const result = await client.query<{ id: string; name: string; currency_code: string | null }>(
      `
        select id::text, display_name as name, coalesce(currency, 'INR') as currency_code
        from public.tenants
        where id = $1
      `,
      [tenantId],
    );
    const row = result.rows[0];
    if (!row) {
      return { id: tenantId, name: "Tenant", currencyCode: "INR" };
    }
    return { id: row.id, name: row.name, currencyCode: row.currency_code ?? "INR" };
  }

  private async getCurrentFinancialYear(
    client: PoolClient,
    tenantId: string,
  ): Promise<FinancialYearInfoResult | null> {
    const currentYear = await client.query<{ id: string; label: string; starts_on: string; ends_on: string }>(
      `
        select id::text, label, start_date::text as starts_on, end_date::text as ends_on
        from public.tenant_financial_years
        where tenant_id = $1
          and status <> 'cancelled'
          and current_date >= start_date
          and current_date <= end_date
        order by start_date desc
        limit 1
      `,
      [tenantId],
    );
    if (currentYear.rows[0]) {
      const row = currentYear.rows[0];
      return { id: row.id, label: row.label, startsOn: row.starts_on, endsOn: row.ends_on };
    }

    return null;
  }

  private async getMetrics(
    client: PoolClient,
    tenantId: string,
    financialYearId: string | undefined,
    currencyCode: string,
  ): Promise<DashboardMetricsResult> {
    if (!financialYearId) {
      const opResult = await client.query<{
        active_clients: number;
        open_tasks: number;
        overdue_tasks: number;
      }>(
        `
          select
            (select count(*)::int from public.clients where tenant_id = $1 and status = 'active') as active_clients,
            (select count(*)::int from public.tasks where tenant_id = $1 and status not in ('completed', 'cancelled')) as open_tasks,
            (select count(*)::int from public.tasks where tenant_id = $1 and status not in ('completed', 'cancelled') and planned_due_at < now()) as overdue_tasks
        `,
        [tenantId],
      );

      const row = opResult.rows[0];

      return {
        activeClients: Number(row?.active_clients ?? 0),
        totalSalesAmount: null,
        collectedAmount: null,
        outstandingAmount: null,
        currencyCode,
        openTasks: Number(row?.open_tasks ?? 0),
        overdueTasks: Number(row?.overdue_tasks ?? 0),
      };
    }

    const query = `
      with scoped_invoices as (
        select i.id, i.tenant_id
        from public.invoices i
        where i.tenant_id = $1
          and i.finalized_at is not null
          and i.status not in ('draft', 'cancelled', 'void')
          and i.financial_year_id = $2
      ), invoice_gross as (
        select coalesce(sum(ii.gross_amount - ii.discount_amount), 0)::numeric as sales
        from scoped_invoices si
        join public.invoice_items ii on ii.invoice_id = si.id and ii.tenant_id = si.tenant_id
      ), payment_total as (
        select coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric as collected
        from public.payments p
        join scoped_invoices si on si.id = p.invoice_id and si.tenant_id = p.tenant_id
      )
      select
        (select count(*)::int from public.clients where tenant_id = $1 and status = 'active') as active_clients,
        (select sales from invoice_gross) as total_sales,
        (select collected from payment_total) as collected,
        (select count(*)::int from public.tasks where tenant_id = $1 and status not in ('completed', 'cancelled')) as open_tasks,
        (select count(*)::int from public.tasks where tenant_id = $1 and status not in ('completed', 'cancelled') and planned_due_at < now()) as overdue_tasks;
    `;

    const result = await client.query<{
      active_clients: number;
      total_sales: string | number | null;
      collected: string | number | null;
      open_tasks: number;
      overdue_tasks: number;
    }>(query, [tenantId, financialYearId]);

    const row = result.rows[0];
    const rawSales = Math.max(0, Number(row?.total_sales ?? 0));
    const rawCollected = Math.max(0, Number(row?.collected ?? 0));
    const rawOutstanding = Math.max(0, rawSales - rawCollected);

    return {
      activeClients: Number(row?.active_clients ?? 0),
      totalSalesAmount: rawSales.toFixed(2),
      collectedAmount: rawCollected.toFixed(2),
      outstandingAmount: rawOutstanding.toFixed(2),
      currencyCode,
      openTasks: Number(row?.open_tasks ?? 0),
      overdueTasks: Number(row?.overdue_tasks ?? 0),
    };
  }

  private async getRecentActivity(client: PoolClient, tenantId: string): Promise<readonly RecentActivityResult[]> {
    const result = await client.query<{ action: string; actor: string; created_at: Date }>(
      `
        select
          ae.action,
          coalesce(u.display_name, 'System') as actor,
          ae.created_at
        from audit.audit_events ae
        left join public.users u on u.id = ae.actor_user_id
        where ae.tenant_id = $1
        order by ae.created_at desc
        limit 5
      `,
      [tenantId],
    );

    return result.rows.map((row) => ({
      action: row.action,
      actor: row.actor,
      createdAt: row.created_at,
    }));
  }
}
