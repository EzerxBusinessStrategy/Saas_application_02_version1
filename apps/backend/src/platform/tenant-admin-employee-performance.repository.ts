import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";

export type RawEmployeePerformanceRow = {
  employee_id: string;
  employee_code: string;
  display_name: string;
  role: string;
  employment_status: string;
  clients_served: number;
  total_assigned_tasks: number;
  completed_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
  cancelled_tasks: number;
  on_time_completed_tasks: number;
  sla_measured_tasks: number;
  sla_met_tasks: number;
  total_actual_sla_minutes: number | null;
  total_target_sla_minutes: number | null;
  sla_minutes_array: number[];
  attributed_revenue: number | null;
  currency_code: string;
};

export type ClientBreakdownRow = {
  employee_id: string;
  client_id: string;
  client_name: string;
  assigned_tasks: number;
  completed_tasks: number;
  on_time_completed_tasks: number;
  sla_measured_tasks: number;
  sla_met_tasks: number;
  total_actual_sla_minutes: number | null;
  total_target_sla_minutes: number | null;
  attributed_revenue: number | null;
  currency_code: string;
};

export type TaskHistoryRow = {
  task_id: string;
  title: string;
  client_name: string;
  assigned_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  allowed_sla_minutes: number | null;
  actual_sla_minutes: number | null;
  sla_status: string;
  revenue_amount: string | null;
  currency_code: string;
};

export type ReportingPeriod = {
  from: string;
  to: string;
  label: string;
};

@Injectable()
export class TenantAdminEmployeePerformanceRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getPerformanceData(
    context: TenantAdminRequestContext,
    params: {
      from?: string;
      to?: string;
      clientId?: string;
      employeeId?: string;
      status?: string;
    },
  ): Promise<{
    period: ReportingPeriod;
    rows: readonly RawEmployeePerformanceRow[];
    tenantCurrency: string;
  }> {
    if (!this.pool) throw databaseNotConfigured();

    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const tenantId = context.tenantId;

      const period = await this.resolvePeriod(client, tenantId, params.from, params.to);
      const tenantCurrency = await this.getTenantCurrency(client, tenantId);

      const rows = await this.queryEmployeePerformance(client, tenantId, period, {
        clientId: params.clientId,
        employeeId: params.employeeId,
        status: params.status,
      }, tenantCurrency);

      return { period, rows, tenantCurrency };
    });
  }

  async getEmployeeDetail(
    context: TenantAdminRequestContext,
    employeeId: string,
    params: { from?: string; to?: string },
  ): Promise<{
    period: ReportingPeriod;
    employeeRow: RawEmployeePerformanceRow | null;
    clientBreakdown: readonly ClientBreakdownRow[];
    taskHistory: readonly TaskHistoryRow[];
    tenantCurrency: string;
  }> {
    if (!this.pool) throw databaseNotConfigured();

    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const tenantId = context.tenantId;

      const period = await this.resolvePeriod(client, tenantId, params.from, params.to);
      const tenantCurrency = await this.getTenantCurrency(client, tenantId);

      const perfData = await this.queryEmployeePerformance(
        client,
        tenantId,
        period,
        { employeeId },
        tenantCurrency,
      );
      const employeeRow = perfData[0] ?? null;

      const clientBreakdown = await this.queryClientBreakdown(client, tenantId, employeeId, period, tenantCurrency);
      const taskHistory = await this.queryTaskHistory(client, tenantId, employeeId, period, tenantCurrency);

      return {
        period,
        employeeRow,
        clientBreakdown,
        taskHistory,
        tenantCurrency,
      };
    });
  }

  private async getTenantCurrency(client: PoolClient, tenantId: string): Promise<string> {
    const res = await client.query<{ currency: string | null }>(
      `select coalesce(currency, 'INR') as currency from public.tenants where id = $1`,
      [tenantId],
    );
    return res.rows[0]?.currency ?? "INR";
  }

  private async resolvePeriod(
    client: PoolClient,
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<ReportingPeriod> {
    if (from && to) {
      return { from, to, label: `${from} to ${to}` };
    }

    const fyRes = await client.query<{ label: string; starts_on: string; ends_on: string }>(
      `
        select label, start_date::text as starts_on, end_date::text as ends_on
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

    if (fyRes.rows[0]) {
      const row = fyRes.rows[0];
      return { from: row.starts_on, to: row.ends_on, label: row.label };
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    return { from: start, to: end, label: `YTD ${now.getFullYear()}` };
  }

  private async queryEmployeePerformance(
    client: PoolClient,
    tenantId: string,
    period: ReportingPeriod,
    filters: { clientId?: string; employeeId?: string; status?: string },
    tenantCurrency: string,
  ): Promise<readonly RawEmployeePerformanceRow[]> {
    const params: (string | number)[] = [tenantId, period.from, period.to];
    let filterSql = "";

    if (filters.clientId) {
      params.push(filters.clientId);
      filterSql += ` and t.client_id = $${params.length}`;
    }
    if (filters.employeeId) {
      params.push(filters.employeeId);
      filterSql += ` and e.id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      filterSql += ` and e.employment_status = $${params.length}`;
    }

    const query = `
      with task_assignee_counts as (
        select ta_all.tenant_id, ta_all.task_id, count(distinct ta_all.employee_id)::int as assignee_count
        from public.task_assignments ta_all
        where ta_all.tenant_id = $1 and ta_all.status = 'active'
        group by ta_all.tenant_id, ta_all.task_id
      ),
      scoped_tasks as (
        select
          e.id as employee_id,
          e.employee_code,
          coalesce(u.display_name, tm.display_name, e.employee_code) as display_name,
          coalesce(e.experience_level, 'Employee') as role,
          e.employment_status,
          t.id as task_id,
          t.client_id,
          t.status as task_status,
          t.planned_due_at,
          t.actual_started_at,
          t.actual_completed_at,
          t.sla_target_minutes,
          t.sla_status,
          ta.assigned_at,
          greatest(0, floor(extract(epoch from (t.actual_completed_at - coalesce(t.actual_started_at, ta.assigned_at, t.planned_start_at, t.created_at))) / 60))::int as actual_sla_minutes,
          bte.net_amount / greatest(1, tac.assignee_count) as task_revenue
        from public.employees e
        join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
        join public.users u on u.id = tm.user_id
        left join public.task_assignments ta on ta.employee_id = e.id and ta.tenant_id = e.tenant_id and ta.status = 'active'
        left join public.tasks t on t.id = ta.task_id and t.tenant_id = ta.tenant_id
          and (
            (t.actual_completed_at >= $2::timestamp and t.actual_completed_at <= $3::timestamp + interval '1 day')
            or (t.actual_completed_at is null and ta.assigned_at >= $2::timestamp and ta.assigned_at <= $3::timestamp + interval '1 day')
          )
        left join task_assignee_counts tac on tac.task_id = t.id and tac.tenant_id = t.tenant_id
        left join public.billable_task_entries bte on bte.task_id = t.id and bte.tenant_id = t.tenant_id
        where e.tenant_id = $1
          ${filterSql}
      )
      select
        employee_id,
        employee_code,
        display_name,
        role,
        employment_status,
        count(distinct client_id) filter (where task_id is not null and task_status <> 'cancelled')::int as clients_served,
        count(distinct task_id) filter (where task_id is not null and task_status <> 'cancelled')::int as total_assigned_tasks,
        count(distinct task_id) filter (where task_status = 'completed')::int as completed_tasks,
        count(distinct task_id) filter (where task_status not in ('completed', 'cancelled'))::int as open_tasks,
        count(distinct task_id) filter (where task_status not in ('completed', 'cancelled') and planned_due_at < now())::int as overdue_tasks,
        count(distinct task_id) filter (where task_status = 'cancelled')::int as cancelled_tasks,
        count(distinct task_id) filter (where task_status = 'completed' and actual_completed_at is not null and planned_due_at is not null and actual_completed_at <= planned_due_at)::int as on_time_completed_tasks,
        count(distinct task_id) filter (where task_status = 'completed' and actual_completed_at is not null)::int as sla_measured_tasks,
        count(distinct task_id) filter (where task_status = 'completed' and sla_status = 'met')::int as sla_met_tasks,
        coalesce(sum(actual_sla_minutes) filter (where task_status = 'completed' and actual_completed_at is not null), 0)::numeric as total_actual_sla_minutes,
        coalesce(sum(sla_target_minutes) filter (where task_status = 'completed' and actual_completed_at is not null and sla_target_minutes is not null), 0)::numeric as total_target_sla_minutes,
        coalesce(array_agg(actual_sla_minutes) filter (where task_status = 'completed' and actual_completed_at is not null), '{}') as sla_minutes_array,
        coalesce(sum(task_revenue) filter (where task_status = 'completed'), 0)::numeric as attributed_revenue
      from scoped_tasks
      group by employee_id, employee_code, display_name, role, employment_status;
    `;

    const res = await client.query<{
      employee_id: string;
      employee_code: string;
      display_name: string;
      role: string;
      employment_status: string;
      clients_served: number;
      total_assigned_tasks: number;
      completed_tasks: number;
      open_tasks: number;
      overdue_tasks: number;
      cancelled_tasks: number;
      on_time_completed_tasks: number;
      sla_measured_tasks: number;
      sla_met_tasks: number;
      total_actual_sla_minutes: string | number;
      total_target_sla_minutes: string | number;
      sla_minutes_array: number[];
      attributed_revenue: string | number;
    }>(query, params);

    return res.rows.map((r) => ({
      employee_id: r.employee_id,
      employee_code: r.employee_code,
      display_name: r.display_name,
      role: r.role,
      employment_status: r.employment_status,
      clients_served: Number(r.clients_served),
      total_assigned_tasks: Number(r.total_assigned_tasks),
      completed_tasks: Number(r.completed_tasks),
      open_tasks: Number(r.open_tasks),
      overdue_tasks: Number(r.overdue_tasks),
      cancelled_tasks: Number(r.cancelled_tasks),
      on_time_completed_tasks: Number(r.on_time_completed_tasks),
      sla_measured_tasks: Number(r.sla_measured_tasks),
      sla_met_tasks: Number(r.sla_met_tasks),
      total_actual_sla_minutes: Number(r.total_actual_sla_minutes),
      total_target_sla_minutes: Number(r.total_target_sla_minutes),
      sla_minutes_array: r.sla_minutes_array ?? [],
      attributed_revenue: Number(r.attributed_revenue),
      currency_code: tenantCurrency,
    }));
  }

  private async queryClientBreakdown(
    client: PoolClient,
    tenantId: string,
    employeeId: string,
    period: ReportingPeriod,
    tenantCurrency: string,
  ): Promise<readonly ClientBreakdownRow[]> {
    const query = `
      select
        c.id as client_id,
        c.display_name as client_name,
        count(distinct t.id) filter (where t.status <> 'cancelled')::int as assigned_tasks,
        count(distinct t.id) filter (where t.status = 'completed')::int as completed_tasks,
        count(distinct t.id) filter (where t.status = 'completed' and t.actual_completed_at is not null and t.planned_due_at is not null and t.actual_completed_at <= t.planned_due_at)::int as on_time_completed_tasks,
        count(distinct t.id) filter (where t.status = 'completed' and t.actual_completed_at is not null)::int as sla_measured_tasks,
        count(distinct t.id) filter (where t.status = 'completed' and t.sla_status = 'met')::int as sla_met_tasks,
        coalesce(sum(floor(extract(epoch from (t.actual_completed_at - coalesce(t.actual_started_at, ta.assigned_at, t.planned_start_at, t.created_at))) / 60)) filter (where t.status = 'completed' and t.actual_completed_at is not null), 0)::numeric as total_actual_sla_minutes,
        coalesce(sum(t.sla_target_minutes) filter (where t.status = 'completed' and t.actual_completed_at is not null and t.sla_target_minutes is not null), 0)::numeric as total_target_sla_minutes,
        coalesce(sum(bte.net_amount), 0)::numeric as attributed_revenue
      from public.task_assignments ta
      join public.tasks t on t.id = ta.task_id and t.tenant_id = ta.tenant_id
      join public.clients c on c.id = t.client_id and c.tenant_id = t.tenant_id
      left join public.billable_task_entries bte on bte.task_id = t.id and bte.tenant_id = t.tenant_id
      where ta.tenant_id = $1
        and ta.employee_id = $2
        and ta.status = 'active'
        and (
          (t.actual_completed_at >= $3::timestamp and t.actual_completed_at <= $4::timestamp + interval '1 day')
          or (t.actual_completed_at is null and ta.assigned_at >= $3::timestamp and ta.assigned_at <= $4::timestamp + interval '1 day')
        )
      group by c.id, c.display_name;
    `;

    const res = await client.query<{
      client_id: string;
      client_name: string;
      assigned_tasks: number;
      completed_tasks: number;
      on_time_completed_tasks: number;
      sla_measured_tasks: number;
      sla_met_tasks: number;
      total_actual_sla_minutes: string | number;
      total_target_sla_minutes: string | number;
      attributed_revenue: string | number;
    }>(query, [tenantId, employeeId, period.from, period.to]);

    return res.rows.map((r) => ({
      employee_id: employeeId,
      client_id: r.client_id,
      client_name: r.client_name,
      assigned_tasks: Number(r.assigned_tasks),
      completed_tasks: Number(r.completed_tasks),
      on_time_completed_tasks: Number(r.on_time_completed_tasks),
      sla_measured_tasks: Number(r.sla_measured_tasks),
      sla_met_tasks: Number(r.sla_met_tasks),
      total_actual_sla_minutes: Number(r.total_actual_sla_minutes),
      total_target_sla_minutes: Number(r.total_target_sla_minutes),
      attributed_revenue: Number(r.attributed_revenue),
      currency_code: tenantCurrency,
    }));
  }

  private async queryTaskHistory(
    client: PoolClient,
    tenantId: string,
    employeeId: string,
    period: ReportingPeriod,
    tenantCurrency: string,
  ): Promise<readonly TaskHistoryRow[]> {
    const query = `
      select
        t.id as task_id,
        t.title,
        c.display_name as client_name,
        ta.assigned_at,
        t.actual_started_at as started_at,
        t.actual_completed_at as completed_at,
        t.sla_target_minutes as allowed_sla_minutes,
        case
          when t.actual_completed_at is not null then
            greatest(0, floor(extract(epoch from (t.actual_completed_at - coalesce(t.actual_started_at, ta.assigned_at, t.planned_start_at, t.created_at))) / 60))::int
          else null
        end as actual_sla_minutes,
        coalesce(t.sla_status, 'not_started') as sla_status,
        bte.net_amount::text as revenue_amount
      from public.task_assignments ta
      join public.tasks t on t.id = ta.task_id and t.tenant_id = ta.tenant_id
      join public.clients c on c.id = t.client_id and c.tenant_id = t.tenant_id
      left join public.billable_task_entries bte on bte.task_id = t.id and bte.tenant_id = t.tenant_id
      where ta.tenant_id = $1
        and ta.employee_id = $2
        and ta.status = 'active'
        and (
          (t.actual_completed_at >= $3::timestamp and t.actual_completed_at <= $4::timestamp + interval '1 day')
          or (t.actual_completed_at is null and ta.assigned_at >= $3::timestamp and ta.assigned_at <= $4::timestamp + interval '1 day')
        )
      order by t.created_at desc
      limit 50;
    `;

    const res = await client.query<{
      task_id: string;
      title: string;
      client_name: string;
      assigned_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
      allowed_sla_minutes: number | null;
      actual_sla_minutes: number | null;
      sla_status: string;
      revenue_amount: string | null;
    }>(query, [tenantId, employeeId, period.from, period.to]);

    return res.rows.map((r) => ({
      task_id: r.task_id,
      title: r.title,
      client_name: r.client_name,
      assigned_at: r.assigned_at,
      started_at: r.started_at,
      completed_at: r.completed_at,
      allowed_sla_minutes: r.allowed_sla_minutes,
      actual_sla_minutes: r.actual_sla_minutes,
      sla_status: r.sla_status,
      revenue_amount: r.revenue_amount,
      currency_code: tenantCurrency,
    }));
  }
}
