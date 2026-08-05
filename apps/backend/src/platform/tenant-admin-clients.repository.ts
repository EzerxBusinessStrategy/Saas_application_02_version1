import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { TenantAdminClientsQuery, TenantAdminContactInput } from "./tenant-admin-clients.dto";

type ClientRow = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly currency_code: string;
  readonly primary_contact_name: string | null;
  readonly primary_contact_email: string | null;
  readonly active_services: number;
  readonly services: string[];
  readonly managers: string[];
  readonly revenue_amount: string;
  readonly outstanding_amount: string;
  readonly upcoming_deadline: Date | null;
  readonly status: "active" | "onboarding" | "paused" | "archived";
  readonly created_at: Date;
  readonly open_tasks: number;
  readonly at_risk_tasks: number;
  readonly onboarding_progress: number;
  readonly document_progress: number;
  readonly total_count?: string;
};

@Injectable()
export class TenantAdminClientsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(context: TenantAdminRequestContext, query: TenantAdminClientsQuery) {
    return this.withContext(context, async (client) => {
      const rows = await this.getClientRows(client, context.tenantId, query);
      const totalItems = Number(rows[0]?.total_count ?? 0);
      return {
        items: rows.map(mapClient),
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(totalItems / query.pageSize)),
        totalItems,
        filters: {
          services: await this.getServiceOptions(client, context.tenantId),
          managers: await this.getManagerOptions(client, context.tenantId),
        },
      };
    });
  }

  async detail(context: TenantAdminRequestContext, clientRef: string) {
    return this.withContext(context, async (client) => {
      const clientId = await this.resolveClientId(client, context.tenantId, clientRef);
      const rows = await this.getClientRows(client, context.tenantId, {
        page: 1,
        pageSize: 1,
        sort: "name",
        deadline: "any",
        clientId,
      } as TenantAdminClientsQuery & { clientId: string });
      if (!rows[0]) throw new NotFoundException({ code: "CLIENT_NOT_FOUND", message: "Client was not found." });
      return {
        ...mapClient(rows[0]),
        contacts: await this.getContacts(client, context.tenantId, clientId),
        engagements: await this.getEngagements(client, context.tenantId, clientId),
        workGroups: await this.getWorkGroups(client, context.tenantId, clientId),
        tasks: await this.getTasks(client, context.tenantId, clientId),
        invoices: await this.getInvoices(client, context.tenantId, clientId),
        activity: await this.getActivity(client, context.tenantId, clientId),
      };
    });
  }

  async createContact(context: TenantAdminRequestContext, clientRef: string, input: TenantAdminContactInput) {
    return this.withContext(context, async (client) => {
      const clientId = await this.resolveClientId(client, context.tenantId, clientRef);
      if (!input.name || !input.email) {
        throw new BadRequestException({ code: "CONTACT_REQUIRED", message: "Contact name and email are required." });
      }
      if (input.primary) await this.clearPrimaryContact(client, context.tenantId, clientId);
      const result = await client.query<{ id: string }>(
        `
          insert into public.client_contacts (
            tenant_id, client_id, name, role_title, email, phone, preference, primary_contact, notes, status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
          returning id::text
        `,
        [
          context.tenantId,
          clientId,
          input.name,
          input.role ?? "",
          input.email,
          input.phone ?? "",
          input.preference ?? "email",
          input.primary ?? false,
          input.notes ?? "",
        ],
      );
      return this.getContact(client, context.tenantId, clientId, result.rows[0].id);
    });
  }

  async updateContact(
    context: TenantAdminRequestContext,
    clientRef: string,
    contactId: string,
    input: TenantAdminContactInput,
  ) {
    return this.withContext(context, async (client) => {
      const clientId = await this.resolveClientId(client, context.tenantId, clientRef);
      if (input.primary) await this.clearPrimaryContact(client, context.tenantId, clientId);
      const result = await client.query(
        `
          update public.client_contacts
          set
            name = coalesce($4, name),
            role_title = coalesce($5, role_title),
            email = coalesce($6, email),
            phone = coalesce($7, phone),
            preference = coalesce($8, preference),
            primary_contact = coalesce($9, primary_contact),
            notes = coalesce($10, notes),
            status = coalesce($11, status),
            updated_at = now()
          where tenant_id = $1
            and client_id = $2
            and id = $3
        `,
        [
          context.tenantId,
          clientId,
          contactId,
          input.name,
          input.role,
          input.email,
          input.phone,
          input.preference,
          input.primary,
          input.notes,
          input.status,
        ],
      );
      if (!result.rowCount) throw new NotFoundException({ code: "CONTACT_NOT_FOUND", message: "Contact was not found." });
      return this.getContact(client, context.tenantId, clientId, contactId);
    });
  }

  private async getClientRows(
    client: PoolClient,
    tenantId: string,
    query: TenantAdminClientsQuery & { clientId?: string },
  ): Promise<readonly ClientRow[]> {
    const result = await client.query<ClientRow>(
      `
        with client_base as (
          select
            c.id,
            c.tenant_id,
            c.code,
            c.display_name as name,
            coalesce(t.currency, 'INR') as currency_code,
            c.created_at,
            case
              when c.status = 'archived' then 'archived'
              when c.status = 'paused' then 'paused'
              when c.status = 'active' and c.onboarding_status in ('active', 'completed') then 'active'
              else 'onboarding'
            end as status,
            case c.onboarding_status
              when 'completed' then 100
              when 'active' then 65
              when 'blocked' then 25
              else 35
            end as onboarding_progress
          from public.clients c
          join public.tenants t on t.id = c.tenant_id
          where c.tenant_id = $1
            and ($2::uuid is null or c.id = $2::uuid)
            and (
              $3::text is null
              or c.id::text ilike '%' || $3 || '%'
              or c.code ilike '%' || $3 || '%'
              or c.legal_name ilike '%' || $3 || '%'
              or c.display_name ilike '%' || $3 || '%'
            )
        ), client_rows as (
          select
            cb.*,
            coalesce(pc.name, 'No primary contact') as primary_contact_name,
            coalesce(pc.email, '') as primary_contact_email,
            coalesce(svc.active_services, 0)::int as active_services,
            coalesce(svc.services, array[]::text[]) as services,
            coalesce(mgr.managers, array[]::text[]) as managers,
            coalesce(fin.revenue_amount, 0)::numeric(18,2) as revenue_amount,
            coalesce(fin.outstanding_amount, 0)::numeric(18,2) as outstanding_amount,
            task_stats.upcoming_deadline,
            coalesce(task_stats.open_tasks, 0)::int as open_tasks,
            coalesce(task_stats.at_risk_tasks, 0)::int as at_risk_tasks,
            0::int as document_progress
          from client_base cb
          left join lateral (
            select cc.name, cc.email
            from public.client_contacts cc
            where cc.tenant_id = cb.tenant_id
              and cc.client_id = cb.id
              and cc.status = 'active'
            order by cc.primary_contact desc, cc.created_at asc
            limit 1
          ) pc on true
          left join lateral (
            select count(distinct e.service_id)::int as active_services, array_agg(distinct s.name order by s.name) as services
            from public.engagements e
            join public.services s on s.id = e.service_id and s.tenant_id = e.tenant_id
            where e.tenant_id = cb.tenant_id
              and e.client_id = cb.id
              and e.status = 'active'
          ) svc on true
          left join lateral (
            select array_agg(distinct tm.display_name order by tm.display_name) as managers
            from public.work_groups wg
            join public.work_group_memberships wgm
              on wgm.work_group_id = wg.id and wgm.tenant_id = wg.tenant_id and wgm.status = 'active' and wgm.group_role = 'manager'
            join public.employees e on e.id = wgm.employee_id and e.tenant_id = wgm.tenant_id
            join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
            where wg.tenant_id = cb.tenant_id
              and wg.client_id = cb.id
              and wg.status = 'active'
          ) mgr on true
          left join lateral (
            with invoice_balances as (
              select i.id, i.total_amount, i.status, coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric as paid
              from public.invoices i
              left join public.payments p on p.invoice_id = i.id and p.tenant_id = i.tenant_id
              where i.tenant_id = cb.tenant_id
                and i.client_id = cb.id
                and i.status not in ('draft', 'cancelled', 'void')
              group by i.id, i.total_amount, i.status
            )
            select
              (
                select coalesce(sum(p.amount), 0)::numeric(18,2)
                from public.payments p
                where p.tenant_id = cb.tenant_id
                  and p.client_id = cb.id
                  and p.status = 'successful'
              ) as revenue_amount,
              coalesce(sum(greatest(ib.total_amount - ib.paid, 0)) filter (where ib.status <> 'paid'), 0)::numeric(18,2) as outstanding_amount
            from invoice_balances ib
          ) fin on true
          left join lateral (
            select
              min(t.planned_due_at) filter (where t.planned_due_at >= now() and t.status not in ('completed', 'cancelled')) as upcoming_deadline,
              count(*) filter (where t.status not in ('completed', 'cancelled'))::int as open_tasks,
              count(*) filter (
                where t.status not in ('completed', 'cancelled')
                  and (t.sla_status in ('near_breach', 'breached') or (t.planned_due_at is not null and t.planned_due_at < now()))
              )::int as at_risk_tasks
            from public.tasks t
            where t.tenant_id = cb.tenant_id
              and t.client_id = cb.id
          ) task_stats on true
        ), filtered as (
          select *
          from client_rows cr
          where ($4::text is null or cr.status = $4)
            and ($5::uuid is null or exists (
              select 1 from public.engagements e where e.tenant_id = cr.tenant_id and e.client_id = cr.id and e.service_id = $5 and e.status = 'active'
            ))
            and ($6::uuid is null or exists (
              select 1
              from public.work_groups wg
              join public.work_group_memberships wgm on wgm.work_group_id = wg.id and wgm.tenant_id = wg.tenant_id and wgm.status = 'active' and wgm.group_role = 'manager'
              join public.employees e on e.id = wgm.employee_id and e.tenant_id = wgm.tenant_id
              where wg.tenant_id = cr.tenant_id and wg.client_id = cr.id and e.id = $6
            ))
            and ($7::numeric is null or cr.revenue_amount >= $7)
            and ($8::text = 'any' or ($8 = 'upcoming' and cr.upcoming_deadline is not null) or ($8 = 'none' and cr.upcoming_deadline is null))
        )
        select *, count(*) over() as total_count
        from filtered
        order by
          case when $9 = 'revenue' then revenue_amount end desc nulls last,
          case when $9 = 'outstanding' then outstanding_amount end desc nulls last,
          case when $9 = 'deadline' then upcoming_deadline end asc nulls last,
          lower(name) asc
        limit $10 offset $11
      `,
      [
        tenantId,
        query.clientId ?? null,
        query.query ?? null,
        query.status ?? null,
        query.service ?? null,
        query.manager ?? null,
        query.revenueMin ?? null,
        query.deadline ?? "any",
        query.sort ?? "name",
        query.pageSize,
        (query.page - 1) * query.pageSize,
      ],
    );
    return result.rows;
  }

  private async resolveClientId(client: PoolClient, tenantId: string, clientRef: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      "select id::text from public.clients where tenant_id = $1 and (id::text = $2 or lower(code) = lower($2))",
      [tenantId, clientRef],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new NotFoundException({ code: "CLIENT_NOT_FOUND", message: "Client was not found." });
    return id;
  }

  private async getServiceOptions(client: PoolClient, tenantId: string) {
    const result = await client.query<{ id: string; name: string }>(
      "select id::text, name from public.services where tenant_id = $1 and status = 'active' order by name",
      [tenantId],
    );
    return result.rows;
  }

  private async getManagerOptions(client: PoolClient, tenantId: string) {
    const result = await client.query<{ id: string; name: string }>(
      `
        select distinct e.id::text as id, tm.display_name as name
        from public.employees e
        join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
        join public.work_group_memberships wgm on wgm.employee_id = e.id and wgm.tenant_id = e.tenant_id and wgm.group_role = 'manager' and wgm.status = 'active'
        where e.tenant_id = $1 and e.employment_status = 'active'
        order by tm.display_name
      `,
      [tenantId],
    );
    return result.rows;
  }

  private async getContacts(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select id::text, name, coalesce(role_title, '') as role, coalesce(email, '') as email,
          coalesce(phone, '') as phone, coalesce(preference, 'email') as preference,
          case when status = 'archived' then 'archived' else 'active' end as status,
          primary_contact as primary, coalesce(notes, '') as notes
        from public.client_contacts
        where tenant_id = $1 and client_id = $2
        order by primary_contact desc, created_at asc
      `,
      [tenantId, clientId],
    );
    return result.rows;
  }

  private async getContact(client: PoolClient, tenantId: string, clientId: string, contactId: string) {
    const result = await this.getContacts(client, tenantId, clientId);
    const contact = result.find((row: { id: string }) => row.id === contactId);
    if (!contact) throw new NotFoundException({ code: "CONTACT_NOT_FOUND", message: "Contact was not found." });
    return contact;
  }

  private async clearPrimaryContact(client: PoolClient, tenantId: string, clientId: string): Promise<void> {
    await client.query("update public.client_contacts set primary_contact = false where tenant_id = $1 and client_id = $2", [
      tenantId,
      clientId,
    ]);
  }

  private async getEngagements(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select e.id::text, e.name, e.code, s.name as service, e.start_date::text as "startDate",
          coalesce(e.end_date::text, 'Ongoing') as "endDate",
          case when e.status = 'paused' then 'on-hold' when e.status = 'completed' then 'complete' when e.status = 'draft' then 'planning' else 'active' end as status,
          'medium' as priority, 'standard' as complexity,
          case when count(t.id) filter (where t.sla_status in ('near_breach', 'breached')) > 0 then 'at-risk' when count(t.id) filter (where t.status not in ('completed', 'cancelled')) > 0 then 'watch' else 'on-track' end as "slaStatus",
          coalesce((array_agg(distinct tm.display_name order by tm.display_name) filter (where tm.display_name is not null))[1], 'Unassigned') as manager,
          count(distinct ta.employee_id)::int as employees,
          count(distinct t.id) filter (where t.status not in ('completed', 'cancelled'))::int as "openTasks",
          case when count(distinct t.id) = 0 then 0 else round((count(distinct t.id) filter (where t.status = 'completed')::numeric / count(distinct t.id)) * 100)::int end as progress,
          s.default_billing_model as "billingModel",
          array[]::text[] as milestones
        from public.engagements e
        join public.services s on s.id = e.service_id and s.tenant_id = e.tenant_id
        left join public.tasks t on t.engagement_id = e.id and t.tenant_id = e.tenant_id
        left join public.task_assignments ta on ta.task_id = t.id and ta.tenant_id = t.tenant_id and ta.status = 'active'
        left join public.work_groups wg on wg.engagement_id = e.id and wg.tenant_id = e.tenant_id
        left join public.work_group_memberships wgm on wgm.work_group_id = wg.id and wgm.tenant_id = wg.tenant_id and wgm.group_role = 'manager' and wgm.status = 'active'
        left join public.employees me on me.id = wgm.employee_id and me.tenant_id = wgm.tenant_id
        left join public.tenant_memberships tm on tm.id = me.membership_id and tm.tenant_id = me.tenant_id
        where e.tenant_id = $1 and e.client_id = $2
        group by e.id, e.name, e.code, s.name, e.start_date, e.end_date, e.status, s.default_billing_model
        order by e.start_date desc
      `,
      [tenantId, clientId],
    );
    return result.rows;
  }

  private async getWorkGroups(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select wg.id::text, wg.name, coalesce(e.name, 'No engagement') as engagement,
          coalesce((array_agg(distinct tm.display_name order by tm.display_name) filter (where tm.display_name is not null))[1], 'Unassigned') as manager,
          count(distinct wgm.employee_id)::int as members,
          count(distinct t.id) filter (where t.status not in ('completed', 'cancelled'))::int as "openTasks",
          case when count(t.id) filter (where t.sla_status in ('near_breach', 'breached')) > 0 then 'at-risk' else 'on-track' end as "slaStatus",
          case when wg.status = 'inactive' then 'on-hold' when wg.status = 'archived' then 'complete' else 'active' end as status
        from public.work_groups wg
        left join public.engagements e on e.id = wg.engagement_id and e.tenant_id = wg.tenant_id
        left join public.work_group_memberships wgm on wgm.work_group_id = wg.id and wgm.tenant_id = wg.tenant_id and wgm.status = 'active'
        left join public.employees me on me.id = wgm.employee_id and me.tenant_id = wgm.tenant_id and wgm.group_role = 'manager'
        left join public.tenant_memberships tm on tm.id = me.membership_id and tm.tenant_id = me.tenant_id
        left join public.tasks t on t.work_group_id = wg.id and t.tenant_id = wg.tenant_id
        where wg.tenant_id = $1 and wg.client_id = $2
        group by wg.id, wg.name, e.name, wg.status
        order by wg.name
      `,
      [tenantId, clientId],
    );
    return result.rows;
  }

  private async getTasks(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select id::text, title, status, priority, planned_due_at as "plannedDueAt"
        from public.tasks
        where tenant_id = $1 and client_id = $2
        order by coalesce(planned_due_at, created_at) desc
        limit 20
      `,
      [tenantId, clientId],
    );
    return result.rows;
  }

  private async getInvoices(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select i.id::text, i.invoice_number as "invoiceNumber", i.status, i.total_amount::float as "totalAmount",
          coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::float as "paidAmount",
          greatest(i.total_amount - coalesce(sum(p.amount) filter (where p.status = 'successful'), 0), 0)::float as "outstandingAmount",
          i.due_on::text as "dueOn", i.currency_code as "currencyCode"
        from public.invoices i
        left join public.payments p on p.invoice_id = i.id and p.tenant_id = i.tenant_id
        where i.tenant_id = $1 and i.client_id = $2 and i.status not in ('draft', 'cancelled', 'void')
        group by i.id, i.invoice_number, i.status, i.total_amount, i.due_on, i.currency_code
        order by i.issued_on desc
        limit 20
      `,
      [tenantId, clientId],
    );
    return result.rows;
  }

  private async getActivity(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select id::text, action, resource_type as "resourceType", created_at as "createdAt"
        from audit.audit_events
        where tenant_id = $1 and metadata->>'clientId' = $2
        order by created_at desc
        limit 8
      `,
      [tenantId, clientId],
    );
    return result.rows;
  }

  private async withContext<T>(context: TenantAdminRequestContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function mapClient(row: ClientRow) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    currencyCode: row.currency_code,
    primaryContact: {
      name: row.primary_contact_name ?? "No primary contact",
      email: row.primary_contact_email ?? "",
    },
    activeServices: Number(row.active_services),
    services: row.services ?? [],
    managers: row.managers ?? [],
    revenueAmount: Number(row.revenue_amount),
    outstandingAmount: Number(row.outstanding_amount),
    upcomingDeadline: row.upcoming_deadline ? row.upcoming_deadline.toISOString() : null,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    openTasks: Number(row.open_tasks),
    atRiskTasks: Number(row.at_risk_tasks),
    onboardingProgress: Number(row.onboarding_progress),
    documentProgress: Number(row.document_progress),
  };
}
