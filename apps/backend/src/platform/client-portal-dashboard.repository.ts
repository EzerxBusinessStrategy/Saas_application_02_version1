import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { ClientPortalRequestContext } from "./client-portal-context";

type SummaryRow = {
  active_services: string;
  open_requests: string;
  outstanding_invoices: string;
  currency_code: string;
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

  async read(context: ClientPortalRequestContext) {
    return this.withContext(context, async (client) => ({
      summary: await this.getSummary(client, context),
      services: await this.getServices(client, context),
      requests: await this.getRequests(client, context),
      invoices: await this.getInvoices(client, context),
    }));
  }

  private async getSummary(client: PoolClient, context: ClientPortalRequestContext): Promise<SummaryRow> {
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
          group by i.id, i.total_amount, i.status
        ),
        visible_services as (
          select e.service_id
          from public.engagements e
          where e.tenant_id = $1
            and e.client_id = $2
            and e.status = 'active'
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
        )
        select
          (
            select count(*)::text
            from visible_services
          ) as active_services,
          (
            select count(*)::text
            from public.client_task_requests ctr
            where ctr.tenant_id = $1
              and ctr.client_id = $2
              and ctr.status not in ('completed', 'cancelled', 'resolved')
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
      [context.tenantId, context.clientAccountId],
    );
    return result.rows[0] ?? {
      active_services: "0",
      open_requests: "0",
      outstanding_invoices: "0",
      currency_code: "INR",
    };
  }

  private async getServices(client: PoolClient, context: ClientPortalRequestContext): Promise<readonly ServiceRow[]> {
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
          coalesce(sum(service_scope.total_tasks), 0)::text as total_tasks
        from service_scope
        join public.services s
          on s.id = service_scope.service_id
         and s.tenant_id = $1
        group by s.id, s.name
        order by lower(coalesce(min(service_scope.engagement_name), s.name)) asc
      `,
      [context.tenantId, context.clientAccountId],
    );
    return result.rows;
  }

  private async getRequests(client: PoolClient, context: ClientPortalRequestContext): Promise<readonly RequestRow[]> {
    const result = await client.query<RequestRow>(
      `
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
        order by ctr.updated_at desc, ctr.id desc
        limit 8
      `,
      [context.tenantId, context.clientAccountId],
    );
    return result.rows;
  }

  private async getInvoices(client: PoolClient, context: ClientPortalRequestContext): Promise<readonly InvoiceRow[]> {
    const result = await client.query<InvoiceRow>(
      `
        select
          i.id::text,
          i.invoice_number,
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
        where i.tenant_id = $1
          and i.client_id = $2
          and i.status not in ('draft', 'cancelled', 'void')
        group by i.id, i.invoice_number, i.status, i.issued_on, i.due_on, i.currency_code, i.total_amount
        order by i.issued_on desc, i.created_at desc
        limit 8
      `,
      [context.tenantId, context.clientAccountId],
    );
    return result.rows;
  }

  private async withContext<T>(
    context: ClientPortalRequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}
