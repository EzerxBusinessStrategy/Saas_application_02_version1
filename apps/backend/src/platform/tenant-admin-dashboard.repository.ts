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
};

export type RecentActivityResult = {
  readonly id: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly result: string;
  readonly metadata: Record<string, unknown>;
  readonly actor: string;
  readonly createdAt: Date;
};

export type OrganisationSetupResult = {
  readonly tenantProfileComplete: boolean;
  readonly financialYearComplete: boolean;
  readonly managerComplete: boolean;
  readonly employeesComplete: boolean;
  readonly clientsComplete: boolean;
  readonly servicesComplete: boolean;
  readonly workGroupsComplete: boolean;
  readonly deliveryRulesComplete: boolean;
};

export type UpcomingDeadlineResult = {
  readonly id: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly dueAt: Date;
  readonly priority: string;
  readonly status: string;
  readonly workGroupName: string | null;
  readonly assigneeCount: number;
};

export type TenantAdminDashboardData = {
  readonly tenant: TenantInfoResult;
  readonly financialYear: FinancialYearInfoResult | null;
  readonly metrics: DashboardMetricsResult;
  readonly recentActivity: readonly RecentActivityResult[];
  readonly organisationSetup: OrganisationSetupResult;
  readonly upcomingDeadlines: readonly UpcomingDeadlineResult[];
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
      const organisationSetup = await this.getOrganisationSetup(client, tenantId);
      const upcomingDeadlines = await this.getUpcomingDeadlines(client, tenantId);

      return {
        tenant,
        financialYear,
        metrics,
        recentActivity,
        organisationSetup,
        upcomingDeadlines,
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
      }>(
        `
          select
            (select count(*)::int from public.clients where tenant_id = $1 and status = 'active') as active_clients,
            (select count(*)::int from public.tasks where tenant_id = $1 and status not in ('completed', 'cancelled')) as open_tasks
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
        (select count(*)::int from public.tasks where tenant_id = $1 and status not in ('completed', 'cancelled')) as open_tasks;
    `;

    const result = await client.query<{
      active_clients: number;
      total_sales: string | number | null;
      collected: string | number | null;
      open_tasks: number;
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
    };
  }

  private async getRecentActivity(client: PoolClient, tenantId: string): Promise<readonly RecentActivityResult[]> {
    const result = await client.query<{
      id: string;
      action: string;
      resource_type: string;
      resource_id: string | null;
      result: string;
      metadata: Record<string, unknown>;
      actor: string;
      created_at: Date;
    }>(
      `
        select
          ae.id::text,
          ae.action,
          ae.resource_type,
          ae.resource_id::text,
          ae.result,
          ae.metadata,
          coalesce(u.display_name, 'System') as actor,
          ae.created_at
        from audit.audit_events ae
        left join public.users u on u.id = ae.actor_user_id
        where ae.tenant_id = $1
          and ae.result = 'succeeded'
          and ae.action <> 'TENANT_ADMIN_LOGGED_IN'
        order by ae.created_at desc
        limit 8
      `,
      [tenantId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      result: row.result,
      metadata: row.metadata,
      actor: row.actor,
      createdAt: row.created_at,
    }));
  }

  private async getOrganisationSetup(client: PoolClient, tenantId: string): Promise<OrganisationSetupResult> {
    const result = await client.query<{
      tenant_profile_complete: boolean | null;
      financial_year_complete: boolean;
      manager_complete: boolean;
      employees_complete: boolean;
      clients_complete: boolean;
      services_complete: boolean;
      work_groups_complete: boolean;
      delivery_rules_complete: boolean;
    }>(
      `
        select
          (
            select country is not null
               and currency is not null
               and timezone is not null
            from public.tenants
            where id = $1
          ) as tenant_profile_complete,
          exists (
            select 1
            from public.tenant_financial_years
            where tenant_id = $1
              and status <> 'cancelled'
              and current_date between start_date and end_date
          ) as financial_year_complete,
          exists (
            select 1
            from public.tenant_memberships tm
            join public.membership_roles mr
              on mr.membership_id = tm.id
             and mr.tenant_id = tm.tenant_id
             and mr.status = 'active'
            join public.roles r on r.id = mr.role_id
            where tm.tenant_id = $1
              and tm.status = 'active'
              and r.code = 'MANAGER'
          ) as manager_complete,
          exists (
            select 1
            from public.employees
            where tenant_id = $1
              and employment_status = 'active'
          ) as employees_complete,
          exists (
            select 1
            from public.clients
            where tenant_id = $1
              and status = 'active'
          ) as clients_complete,
          exists (
            select 1
            from public.services
            where tenant_id = $1
              and status = 'active'
          ) as services_complete,
          exists (
            select 1
            from public.work_groups wg
            join public.work_group_memberships wgm
              on wgm.work_group_id = wg.id
             and wgm.tenant_id = wg.tenant_id
             and wgm.status = 'active'
            where wg.tenant_id = $1
              and wg.status = 'active'
          ) as work_groups_complete,
          (
            exists (
              select 1
              from public.sla_policies
              where tenant_id = $1
                and status = 'active'
            )
            or exists (
              select 1
              from public.compliance_calendar_rules
              where tenant_id = $1
                and status = 'active'
            )
          ) as delivery_rules_complete
      `,
      [tenantId],
    );
    const row = result.rows[0];
    return {
      tenantProfileComplete: Boolean(row?.tenant_profile_complete),
      financialYearComplete: Boolean(row?.financial_year_complete),
      managerComplete: Boolean(row?.manager_complete),
      employeesComplete: Boolean(row?.employees_complete),
      clientsComplete: Boolean(row?.clients_complete),
      servicesComplete: Boolean(row?.services_complete),
      workGroupsComplete: Boolean(row?.work_groups_complete),
      deliveryRulesComplete: Boolean(row?.delivery_rules_complete),
    };
  }

  private async getUpcomingDeadlines(client: PoolClient, tenantId: string): Promise<readonly UpcomingDeadlineResult[]> {
    const result = await client.query<{
      id: string;
      task_id: string;
      task_title: string;
      client_id: string;
      client_name: string;
      priority: string;
      status: string;
      planned_due_at: Date;
      work_group_name: string | null;
      assigned_employee_count: number;
    }>(
      `
        select
          t.id::text,
          t.id::text as task_id,
          t.title as task_title,
          c.id::text as client_id,
          c.display_name as client_name,
          t.priority,
          t.status,
          t.planned_due_at,
          wg.name as work_group_name,
          count(distinct ta.employee_id)::int as assigned_employee_count
        from public.tasks t
        join public.clients c
          on c.id = t.client_id
         and c.tenant_id = t.tenant_id
        left join public.work_groups wg
          on wg.id = t.work_group_id
         and wg.tenant_id = t.tenant_id
        left join public.task_assignments ta
          on ta.task_id = t.id
         and ta.tenant_id = t.tenant_id
         and ta.status = 'active'
        where t.tenant_id = $1
          and t.status not in ('completed', 'cancelled')
          and t.planned_due_at >= now()
          and t.planned_due_at < now() + interval '14 days'
        group by
          t.id,
          t.title,
          c.id,
          c.display_name,
          t.priority,
          t.status,
          t.planned_due_at,
          wg.name
        order by
          t.planned_due_at asc
        limit 8
      `,
      [tenantId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      clientId: row.client_id,
      clientName: row.client_name,
      dueAt: row.planned_due_at,
      priority: row.priority,
      status: row.status,
      workGroupName: row.work_group_name,
      assigneeCount: Number(row.assigned_employee_count),
    }));
  }
}
