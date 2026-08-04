import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAnalyticsQuery } from "./tenant-analytics.dto";

type TenantRow = { id: string; name: string; code: string; status: string; currency_code: string | null };
type FinancialYearRow = { id: string; label: string; start_date: string; end_date: string };
type MetricsRow = { turnover: string; collected: string; outstanding: string; invoices: string; payments: string; clients: string; active_employees: string; total_tasks: string; completed_tasks: string; sla_compliant_tasks: string; sla_measured_tasks: string; assigned_tasks: string };
type TrendRow = { month: string; turnover: string; collected: string };
type ClientRevenueRow = { client_name: string; turnover: string };

@Injectable()
export class TenantAnalyticsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async get(context: RequestContext, query: TenantAnalyticsQuery) {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const tenants = await this.getTenants(client);
      const selectedTenant = query.tenantId ? tenants.find((tenant) => tenant.id === query.tenantId) ?? null : null;
      const financialYears = selectedTenant ? await this.getFinancialYears(client, selectedTenant.id) : [];
      const selectedFinancialYear = query.financialYearId
        ? financialYears.find((year) => year.id === query.financialYearId) ?? null
        : null;
      if (query.tenantId && !selectedTenant) return { tenants, selectedTenant: null, financialYears, selectedFinancialYear: null, metrics: emptyMetrics(), trend: [], clientRevenue: [] };
      if (query.financialYearId && !selectedFinancialYear) return { tenants, selectedTenant, financialYears, selectedFinancialYear: null, metrics: emptyMetrics(), trend: [], clientRevenue: [] };
      const filter = analyticsFilter(query, selectedFinancialYear);
      const [metrics, trend, clientRevenue] = await Promise.all([
        this.getMetrics(client, filter),
        this.getTrend(client, filter),
        this.getClientRevenue(client, filter),
      ]);
      return { tenants, selectedTenant, financialYears, selectedFinancialYear, metrics, trend, clientRevenue };
    });
  }

  private async getTenants(client: PoolClient): Promise<readonly TenantRow[]> {
    return (await client.query<TenantRow>("select id::text, display_name as name, code, status, currency as currency_code from public.tenants where status <> 'archived' order by display_name")).rows;
  }

  private async getFinancialYears(client: PoolClient, tenantId: string): Promise<readonly FinancialYearRow[]> {
    return (await client.query<FinancialYearRow>("select id::text, label, start_date::text, end_date::text from public.tenant_financial_years where tenant_id = $1 and status <> 'cancelled' order by start_date desc", [tenantId])).rows;
  }

  private async getMetrics(client: PoolClient, filter: AnalyticsFilter): Promise<MetricsRow> {
    const result = await client.query<MetricsRow>(`
      with scoped_invoices as (
        select i.id, i.tenant_id, i.client_id, i.finalized_at, i.financial_year_id
        from public.invoices i
        where i.finalized_at is not null and i.status not in ('draft', 'cancelled', 'void') and ${filter.invoiceWhere}
      ), invoice_totals as (
        select si.id, si.tenant_id, si.client_id, coalesce(sum(ii.gross_amount - ii.discount_amount), 0)::numeric as turnover
        from scoped_invoices si left join public.invoice_items ii on ii.invoice_id = si.id and ii.tenant_id = si.tenant_id group by si.id, si.tenant_id, si.client_id
      ), payment_totals as (
        select p.invoice_id, p.tenant_id, coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric as collected, count(*) filter (where p.status = 'successful') as payments
        from public.payments p join scoped_invoices si on si.id = p.invoice_id and si.tenant_id = p.tenant_id group by p.invoice_id, p.tenant_id
      ), scoped_tasks as (
        select t.id, t.tenant_id, t.status, t.sla_status from public.tasks t where ${filter.taskWhere}
      ), assigned_tasks as (
        select count(distinct ta.task_id)::text as total from public.task_assignments ta join scoped_tasks st on st.id = ta.task_id and st.tenant_id = ta.tenant_id where ta.status not in ('removed', 'cancelled')
      )
      select
        coalesce(sum(it.turnover), 0)::text as turnover,
        coalesce(sum(pt.collected), 0)::text as collected,
        greatest(coalesce(sum(it.turnover), 0) - coalesce(sum(pt.collected), 0), 0)::text as outstanding,
        count(distinct it.id)::text as invoices,
        coalesce(sum(pt.payments), 0)::text as payments,
        (select count(*)::text from public.clients c where ${filter.clientWhere} and c.status = 'active') as clients,
        (select count(*)::text from public.employees e where ${filter.employeeWhere} and e.employment_status = 'active') as active_employees,
        (select count(*)::text from scoped_tasks) as total_tasks,
        (select count(*)::text from scoped_tasks where status = 'completed') as completed_tasks,
        (select count(*)::text from scoped_tasks where sla_status = 'met') as sla_compliant_tasks,
        (select count(*)::text from scoped_tasks where sla_status in ('met', 'breached')) as sla_measured_tasks,
        (select total from assigned_tasks) as assigned_tasks
      from invoice_totals it left join payment_totals pt on pt.invoice_id = it.id and pt.tenant_id = it.tenant_id`, filter.params);
    return result.rows[0] ?? emptyMetrics();
  }

  private async getTrend(client: PoolClient, filter: AnalyticsFilter): Promise<readonly TrendRow[]> {
    return (await client.query<TrendRow>(`
      with scoped as (select i.id, i.tenant_id, date_trunc('month', i.finalized_at)::date as month from public.invoices i where i.finalized_at is not null and i.status not in ('draft', 'cancelled', 'void') and ${filter.invoiceWhere}),
      invoice_totals as (select s.id, s.tenant_id, s.month, coalesce(sum(ii.gross_amount - ii.discount_amount), 0)::numeric as turnover from scoped s left join public.invoice_items ii on ii.invoice_id = s.id and ii.tenant_id = s.tenant_id group by s.id, s.tenant_id, s.month),
      payment_totals as (select p.invoice_id, p.tenant_id, coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric as collected from public.payments p join scoped s on s.id = p.invoice_id and s.tenant_id = p.tenant_id group by p.invoice_id, p.tenant_id)
      select to_char(it.month, 'Mon YYYY') as month, coalesce(sum(it.turnover), 0)::text as turnover, coalesce(sum(pt.collected), 0)::text as collected
      from invoice_totals it left join payment_totals pt on pt.invoice_id = it.id and pt.tenant_id = it.tenant_id
      group by it.month order by it.month`, filter.params)).rows;
  }

  private async getClientRevenue(client: PoolClient, filter: AnalyticsFilter): Promise<readonly ClientRevenueRow[]> {
    return (await client.query<ClientRevenueRow>(`
      select c.display_name as client_name, coalesce(sum(ii.gross_amount - ii.discount_amount), 0)::text as turnover
      from public.invoices i join public.clients c on c.id = i.client_id and c.tenant_id = i.tenant_id left join public.invoice_items ii on ii.invoice_id = i.id and ii.tenant_id = i.tenant_id
      where i.finalized_at is not null and i.status not in ('draft', 'cancelled', 'void') and ${filter.invoiceWhere}
      group by c.id, c.display_name order by sum(ii.gross_amount - ii.discount_amount) desc nulls last limit 6`, filter.params)).rows;
  }
}

type AnalyticsFilter = { params: unknown[]; invoiceWhere: string; taskWhere: string; clientWhere: string; employeeWhere: string };
function analyticsFilter(query: TenantAnalyticsQuery, year: FinancialYearRow | null): AnalyticsFilter {
  const params: unknown[] = [];
  const tenantParam = query.tenantId ? `$${params.push(query.tenantId)}` : null;
  const tenantWhere = (alias: string) => tenantParam ? `${alias}.tenant_id = ${tenantParam}` : "true";
  if (year) {
    const yearParam = `$${params.push(year.id)}`;
    return { params, invoiceWhere: `${tenantWhere("i")} and i.financial_year_id = ${yearParam}`, taskWhere: `${tenantWhere("t")} and t.financial_year_id = ${yearParam}`, clientWhere: tenantWhere("c"), employeeWhere: tenantWhere("e") };
  }
  if (query.from && query.to) {
    const from = `$${params.push(query.from)}`;
    const to = `$${params.push(query.to)}`;
    return { params, invoiceWhere: `${tenantWhere("i")} and i.finalized_at >= ${from}::date and i.finalized_at < (${to}::date + interval '1 day')`, taskWhere: `${tenantWhere("t")} and coalesce(t.actual_completed_at, t.planned_due_at, t.created_at) >= ${from}::date and coalesce(t.actual_completed_at, t.planned_due_at, t.created_at) < (${to}::date + interval '1 day')`, clientWhere: tenantWhere("c"), employeeWhere: tenantWhere("e") };
  }
  return { params, invoiceWhere: `${tenantWhere("i")} and i.financial_year_id in (select id from public.tenant_financial_years fy where fy.tenant_id = i.tenant_id and fy.start_date <= current_date and fy.end_date >= current_date)`, taskWhere: `${tenantWhere("t")} and t.financial_year_id in (select id from public.tenant_financial_years fy where fy.tenant_id = t.tenant_id and fy.start_date <= current_date and fy.end_date >= current_date)`, clientWhere: tenantWhere("c"), employeeWhere: tenantWhere("e") };
}
function emptyMetrics(): MetricsRow { return { turnover: "0", collected: "0", outstanding: "0", invoices: "0", payments: "0", clients: "0", active_employees: "0", total_tasks: "0", completed_tasks: "0", sla_compliant_tasks: "0", sla_measured_tasks: "0", assigned_tasks: "0" }; }
