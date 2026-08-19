import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { ClientPortalRequestContext, ClientPortalScope, resolveClientPortalScope } from "./client-portal-context";
import type { DashboardPeriod } from "./tenant-admin-dashboard.period";

type SummaryRow = {
  active_services: string;
  pending_tasks: string;
  completed_tasks: string;
  open_requests: string;
  outstanding_invoices: string;
  currency_code: string;
};

type ServiceTaskJson = {
  id: string;
  title: string;
  status: string;
  plannedDueAt: string | Date | null;
  rateAmount?: number | string;
  currencyCode?: string;
};

type ServiceRow = {
  id: string;
  engagement_name: string;
  service_name: string;
  status: string;
  next_due_at: Date | null;
  open_tasks: string;
  completed_tasks: string;
  total_tasks: string;
  assigned_employee_name: string | null;
  estimated_total: string | null;
  discount_percent: string | null;
  task_total: string;
  currency_code: string | null;
  tasks: readonly ServiceTaskJson[] | string;
};

type RequestRow = {
  id: string;
  title: string;
  status: string;
  service_name: string;
  country_code: string;
  requested_due_date: string | null;
  submitted_at: Date;
  updated_at: Date;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  task_title: string | null;
  service_name: string | null;
  billing_frequency: string | null;
  billing_period_key: string | null;
  item_count: string;
  items: unknown;
  status: string;
  issued_on: string;
  due_on: string | null;
  currency_code: string;
  total_amount: string;
  paid_amount: string;
  outstanding_amount: string;
};

@Injectable()
export class ClientPortalDashboardRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async read(context: ClientPortalRequestContext, period: DashboardPeriod) {
    return this.withContext(context, async (client, scope) => ({
      summary: await this.getSummary(client, scope, period),
      services: await this.getServices(client, scope, period),
      requests: await this.getRequests(client, scope, period),
      invoices: await this.getInvoices(client, scope, period),
    }));
  }

  private async getSummary(
    client: PoolClient,
    context: ClientPortalScope,
    period: DashboardPeriod,
  ): Promise<SummaryRow> {
    const result = await client.query<SummaryRow>(
      `
        with invoice_balances as (
          select
            i.id,
            i.total_amount,
            i.status,
            coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric as paid_amount
          from public.invoices i
          left join public.payments p
            on p.invoice_id = i.id
           and p.tenant_id = i.tenant_id
          where i.tenant_id = $1
            and i.client_id = $2
            and i.status not in ('draft', 'cancelled', 'void')
            and i.issued_on between $3::date and $4::date
          group by i.id, i.total_amount, i.status
        ),
        visible_services as (
          select e.service_id
          from public.engagements e
          where e.tenant_id = $1
            and e.client_id = $2
            and e.status = 'active'
            and not exists (
              select 1
              from public.tasks t
              where t.tenant_id = e.tenant_id
                and t.client_id = e.client_id
                and t.service_id = e.service_id
                and t.status <> 'cancelled'
            )
          union
          select coalesce(t.service_id, rci.service_id)
          from public.tasks t
          left join public.billable_task_entries bte
            on bte.task_id = t.id
           and bte.tenant_id = t.tenant_id
          left join public.rate_card_items rci
            on rci.id = bte.rate_card_item_id
           and rci.tenant_id = bte.tenant_id
          where t.tenant_id = $1
            and t.client_id = $2
            and t.status <> 'cancelled'
            and coalesce(t.service_id, rci.service_id) is not null
            and coalesce(t.planned_due_at::date, t.created_at::date) between $3::date and $4::date
        )
        select
          (
            select count(*)::text
            from visible_services
          ) as active_services,
          (
            select count(*)::text
            from public.tasks t
            where t.tenant_id = $1
              and t.client_id = $2
              and t.status not in ('completed', 'cancelled')
              and coalesce(t.planned_due_at::date, t.created_at::date) between $3::date and $4::date
          ) as pending_tasks,
          (
            select count(*)::text
            from public.tasks t
            where t.tenant_id = $1
              and t.client_id = $2
              and t.status = 'completed'
              and coalesce(t.planned_due_at::date, t.created_at::date) between $3::date and $4::date
          ) as completed_tasks,
          (
            select (
              (
                select count(*)
                from public.client_task_requests ctr
                where ctr.tenant_id = $1
                  and ctr.client_id = $2
                  and ctr.status in ('submitted', 'under_review')
                  and ctr.submitted_at::date between $3::date and $4::date
                  and not exists (
                    select 1
                    from public.engagements e
                    where e.tenant_id = ctr.tenant_id
                      and e.client_id = ctr.client_id
                      and e.service_id = ctr.service_id
                      and e.status = 'active'
                      and e.start_date >= ctr.submitted_at::date
                  )
              ) + (
                select count(*)
                from public.client_service_requests csr
                where csr.tenant_id = $1
                  and csr.client_id = $2
                  and csr.status = 'submitted'
                  and csr.submitted_at::date between $3::date and $4::date
              )
            )::text
          ) as open_requests,
          coalesce(
            (
              select sum(greatest(total_amount - paid_amount, 0))
              from invoice_balances
              where status <> 'paid'
            ),
            0
          )::text as outstanding_invoices,
          coalesce(t.currency, 'INR') as currency_code
        from public.tenants t
        where t.id = $1
      `,
      [context.tenantId, context.clientId, period.from, period.to],
    );
    return result.rows[0] ?? {
      active_services: "0",
      pending_tasks: "0",
      completed_tasks: "0",
      open_requests: "0",
      outstanding_invoices: "0",
      currency_code: "INR",
    };
  }

  private async getServices(
    client: PoolClient,
    context: ClientPortalScope,
    period: DashboardPeriod,
  ): Promise<readonly ServiceRow[]> {
    const result = await client.query<ServiceRow>(
      `
        with service_scope as (
          select
            coalesce(t.service_id, rci.service_id) as service_id,
            min(e.name) filter (where e.status = 'active') as engagement_name,
            min(t.planned_due_at) filter (
              where t.status not in ('completed', 'cancelled')
                and t.planned_due_at >= now()
            ) as next_due_at,
            count(distinct t.id) filter (where t.status not in ('completed', 'cancelled'))::int as open_tasks,
            count(distinct t.id) filter (where t.status = 'completed')::int as completed_tasks,
            count(distinct t.id)::int as total_tasks,
            bool_or(t.status not in ('completed', 'cancelled')) as has_active_tasks
          from public.tasks t
          left join public.billable_task_entries bte
            on bte.task_id = t.id
           and bte.tenant_id = t.tenant_id
          left join public.rate_card_items rci
            on rci.id = bte.rate_card_item_id
           and rci.tenant_id = bte.tenant_id
          left join public.engagements e
            on e.tenant_id = t.tenant_id
           and e.client_id = t.client_id
           and e.service_id = coalesce(t.service_id, rci.service_id)
          where t.tenant_id = $1
            and t.client_id = $2
            and t.status <> 'cancelled'
            and coalesce(t.service_id, rci.service_id) is not null
            and coalesce(t.planned_due_at::date, t.created_at::date) between $3::date and $4::date
          group by coalesce(t.service_id, rci.service_id)

          union

          select
            e.service_id,
            min(e.name) as engagement_name,
            null::timestamptz as next_due_at,
            0::int as open_tasks,
            0::int as completed_tasks,
            0::int as total_tasks,
            true as has_active_tasks
          from public.engagements e
          where e.tenant_id = $1
            and e.client_id = $2
            and e.status = 'active'
            and not exists (
              select 1
              from public.tasks t
              where t.tenant_id = e.tenant_id
                and t.client_id = e.client_id
                and t.service_id = e.service_id
                and t.status <> 'cancelled'
            )
          group by e.service_id
        )
        select
          s.id::text,
          coalesce(min(service_scope.engagement_name), s.name) as engagement_name,
          s.name as service_name,
          case
            when bool_or(service_scope.has_active_tasks) then 'active'
            when coalesce(sum(service_scope.completed_tasks), 0) > 0 then 'completed'
            else 'planning'
          end as status,
          min(service_scope.next_due_at) as next_due_at,
          coalesce(sum(service_scope.open_tasks), 0)::text as open_tasks,
          coalesce(sum(service_scope.completed_tasks), 0)::text as completed_tasks,
          coalesce(sum(service_scope.total_tasks), 0)::text as total_tasks,
          max(assigned.assigned_employee_name) as assigned_employee_name,
          max(assigned.estimated_total) as estimated_total,
          max(assigned.discount_percent) as discount_percent,
          coalesce((array_agg(service_tasks.task_total))[1], 0)::text as task_total,
          max(assigned.currency_code) as currency_code,
          coalesce((array_agg(service_tasks.tasks))[1], '[]'::json) as tasks
        from service_scope
        join public.services s
          on s.id = service_scope.service_id
         and s.tenant_id = $1
        left join lateral (
          select
            coalesce(tm.display_name, u.display_name, emp.employee_code) as assigned_employee_name,
            esc.estimated_total::text as estimated_total,
            esc.discount_percent::text as discount_percent,
            esc.currency_code
          from public.engagements e
          join public.engagement_service_configurations esc
            on esc.tenant_id = e.tenant_id
           and esc.engagement_id = e.id
           and esc.status = 'active'
          join public.employees emp
            on emp.id = esc.assigned_employee_id
           and emp.tenant_id = e.tenant_id
          join public.tenant_memberships tm
            on tm.id = emp.membership_id
           and tm.tenant_id = e.tenant_id
          left join public.users u on u.id = tm.user_id
          where e.tenant_id = $1
            and e.client_id = $2
            and e.service_id = s.id
            and e.status = 'active'
          order by e.start_date desc
          limit 1
        ) assigned on true
        left join lateral (
          select coalesce(
            json_agg(
              json_build_object(
                'id', priced.id::text,
                'title', priced.title,
                'status', priced.status,
                'plannedDueAt', priced.planned_due_at,
                'rateAmount', priced.rate_amount,
                'currencyCode', priced.currency_code
              )
              order by priced.planned_due_at nulls last, priced.title
            ),
            '[]'::json
          ) as tasks,
          coalesce(sum(priced.rate_amount), 0) as task_total
          from (
            select
              t.id,
              t.title,
              t.status,
              t.planned_due_at,
              coalesce(
                max(bte.gross_amount) filter (where bte.id is not null),
                max(rci.rate_amount),
                0
              ) as rate_amount,
              coalesce(
                max(nullif(bte.currency_code, '')) filter (where bte.id is not null),
                'INR'
              ) as currency_code
            from public.tasks t
            left join public.billable_task_entries bte
              on bte.task_id = t.id
             and bte.tenant_id = t.tenant_id
             and bte.status <> 'cancelled'
            left join public.rate_card_items rci
              on rci.tenant_id = t.tenant_id
             and rci.id = coalesce(t.rate_card_item_id, bte.rate_card_item_id)
            where t.tenant_id = $1
              and t.client_id = $2
              and t.service_id = s.id
              and t.status <> 'cancelled'
              and coalesce(t.planned_due_at::date, t.created_at::date) between $3::date and $4::date
            group by t.id, t.title, t.status, t.planned_due_at
          ) priced
        ) service_tasks on true
        group by s.id, s.name
        order by lower(coalesce(min(service_scope.engagement_name), s.name)) asc
      `,
      [context.tenantId, context.clientId, period.from, period.to],
    );
    return result.rows;
  }

  private async getRequests(
    client: PoolClient,
    context: ClientPortalScope,
    period: DashboardPeriod,
  ): Promise<readonly RequestRow[]> {
    const result = await client.query<RequestRow>(
      `
        select * from (
          select
            ctr.id::text,
            ctr.title,
            ctr.status,
            s.name as service_name,
            ctr.country_code,
            ctr.requested_due_date::text,
            ctr.submitted_at,
            ctr.updated_at
          from public.client_task_requests ctr
          join public.services s
            on s.id = ctr.service_id
           and s.tenant_id = ctr.tenant_id
          where ctr.tenant_id = $1
            and ctr.client_id = $2
            and ctr.submitted_at::date between $3::date and $4::date
            and not (
              ctr.status in ('submitted', 'under_review')
              and exists (
                select 1
                from public.engagements e
                where e.tenant_id = ctr.tenant_id
                  and e.client_id = ctr.client_id
                  and e.service_id = ctr.service_id
                  and e.status = 'active'
                  and e.start_date >= ctr.submitted_at::date
              )
            )
          union all
          select
            csr.id::text,
            csr.title,
            csr.status,
            coalesce((
              select string_agg(s.name, ', ' order by lower(s.name))
              from public.client_service_request_items csri
              join public.services s
                on s.tenant_id = csri.tenant_id
               and s.id = csri.service_id
              where csri.tenant_id = csr.tenant_id
                and csri.request_id = csr.id
            ), 'Custom request') as service_name,
            csr.country_code,
            null::text as requested_due_date,
            csr.submitted_at,
            csr.updated_at
          from public.client_service_requests csr
          where csr.tenant_id = $1
            and csr.client_id = $2
            and csr.submitted_at::date between $3::date and $4::date
        ) requests
        order by updated_at desc, id desc
        limit 8
      `,
      [context.tenantId, context.clientId, period.from, period.to],
    );
    return result.rows;
  }

  private async getInvoices(
    client: PoolClient,
    context: ClientPortalScope,
    period: DashboardPeriod,
  ): Promise<readonly InvoiceRow[]> {
    const result = await client.query<InvoiceRow>(
      `
        select
          i.id::text,
          i.invoice_number,
          item_data.task_title,
          item_data.service_name,
          item_data.billing_frequency,
          item_data.billing_period_key,
          item_data.item_count,
          item_data.items,
          i.status,
          i.issued_on::text,
          i.due_on::text,
          i.currency_code,
          i.total_amount::text,
          coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::text as paid_amount,
          greatest(i.total_amount - coalesce(sum(p.amount) filter (where p.status = 'successful'), 0), 0)::text as outstanding_amount
        from public.invoices i
        left join public.payments p
          on p.invoice_id = i.id
         and p.tenant_id = i.tenant_id
        left join lateral (
          select
            string_agg(t.title, ', ' order by t.title) as task_title,
            min(s.name) as service_name,
            min(bte.billing_frequency) as billing_frequency,
            min(bte.billing_period_key) as billing_period_key,
            count(ii.id)::text as item_count,
            coalesce(
              json_agg(
                json_build_object(
                  'description', ii.description,
                  'netAmount', ii.net_amount
                )
                order by t.planned_due_at nulls last, t.title, ii.id
              ) filter (where ii.id is not null),
              '[]'::json
            ) as items
          from public.invoice_items ii
          left join public.tasks t on t.tenant_id = ii.tenant_id and t.id = ii.task_id
          left join public.services s on s.tenant_id = ii.tenant_id and s.id = coalesce(ii.service_id, t.service_id)
          left join public.billable_task_entries bte on bte.tenant_id = ii.tenant_id and bte.id = ii.billable_task_entry_id
          where ii.tenant_id = i.tenant_id and ii.invoice_id = i.id
        ) item_data on true
        where i.tenant_id = $1
          and i.client_id = $2
          and i.status not in ('draft', 'cancelled', 'void')
          and i.issued_on between $3::date and $4::date
        group by i.id, i.invoice_number, item_data.task_title, item_data.service_name, item_data.billing_frequency,
                 item_data.billing_period_key, item_data.item_count, item_data.items, i.status, i.issued_on, i.due_on,
                 i.currency_code, i.total_amount
        order by i.issued_on desc, i.created_at desc
        limit 8
      `,
      [context.tenantId, context.clientId, period.from, period.to],
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
