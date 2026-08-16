import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { TenantAdminClientCreateInput, TenantAdminClientsQuery, TenantAdminContactInput } from "./tenant-admin-clients.dto";

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
        rateItems: await this.getRateItems(client, context.tenantId, clientId),
        activity: await this.getActivity(client, context.tenantId, clientId),
      };
    });
  }

  async archive(context: TenantAdminRequestContext, clientRef: string): Promise<void> {
    await this.withContext(context, async (client) => {
      const clientId = await this.resolveClientId(client, context.tenantId, clientRef);
      const result = await client.query(
        `
          update public.clients
          set status = 'archived',
              archived_at = coalesce(archived_at, now()),
              updated_at = now()
          where tenant_id = $1
            and id = $2
            and status <> 'archived'
        `,
        [context.tenantId, clientId],
      );
      if (!result.rowCount) return;
      await client.query(
        "select audit.write_audit_event('CLIENT_ARCHIVED', 'client', $1::uuid, 'succeeded', null, $2::jsonb)",
        [clientId, JSON.stringify({ clientId })],
      );
    });
  }

  async create(context: TenantAdminRequestContext, input: TenantAdminClientCreateInput, passwordHash: string) {
    return this.withContext(context, async (client) => {
      const code = input.code ? normalizeClientCode(input.code) : await this.nextClientCode(client, context.tenantId);
      const inserted = await client.query<{ id: string }>(
        `
          insert into public.clients (
            tenant_id,
            code,
            legal_name,
            display_name,
            status,
            onboarding_status
          )
          values ($1, $2, $3, $4, 'active', 'pending')
          returning id::text
        `,
        [context.tenantId, code, input.legalName || input.displayName, input.displayName],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException({ code: "CLIENT_CODE_EXISTS", message: "A client with this code already exists." });
        }
        throw error;
      });
      const clientId = inserted.rows[0]?.id;
      if (!clientId) throw new ConflictException({ code: "CLIENT_CREATE_FAILED", message: "Client could not be created." });

      if (input.primaryContact) {
        await client.query(
          `
            insert into public.client_contacts (
              tenant_id,
              client_id,
              name,
              role_title,
              email,
              phone,
              preference,
              primary_contact,
              notes,
              status
            )
            values ($1, $2, $3, $4, $5, $6, 'email', true, '', 'active')
          `,
          [
            context.tenantId,
            clientId,
            input.primaryContact.name,
            input.primaryContact.role ?? "",
            input.primaryContact.email,
            input.primaryContact.phone ?? "",
          ],
        );
      }

      await this.createClientPortalAccess(client, context, clientId, input, passwordHash);

      await client.query(
        "select audit.write_audit_event('CLIENT_CREATED', 'client', $1::uuid, 'succeeded', null, $2::jsonb)",
        [
          clientId,
          JSON.stringify({
            clientId,
            code,
            displayName: input.displayName,
            portalEmail: input.portalAccess.email,
          }),
        ],
      );
      const rows = await this.getClientRows(client, context.tenantId, {
        page: 1,
        pageSize: 1,
        sort: "name",
        deadline: "any",
        clientId,
      } as TenantAdminClientsQuery & { clientId: string });
      if (!rows[0]) throw new ConflictException({ code: "CLIENT_CREATE_FAILED", message: "Client could not be loaded after creation." });
      return {
        ...mapClient(rows[0]),
        contacts: await this.getContacts(client, context.tenantId, clientId),
        engagements: [],
        workGroups: [],
        tasks: [],
        invoices: [],
        rateItems: [],
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

  private async nextClientCode(client: PoolClient, tenantId: string): Promise<string> {
    const result = await client.query<{ next_number: string }>(
      `
        select coalesce(max(substring(code from '^cl-([0-9]+)$')::int), 100) + 1 as next_number
        from public.clients
        where tenant_id = $1
          and code ~ '^cl-[0-9]+$'
      `,
      [tenantId],
    );
    return `cl-${String(Number(result.rows[0]?.next_number ?? 101)).padStart(3, "0")}`;
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

  private async createClientPortalAccess(
    client: PoolClient,
    context: TenantAdminRequestContext,
    clientId: string,
    input: TenantAdminClientCreateInput,
    passwordHash: string,
  ): Promise<void> {
    const portalEmail = input.portalAccess.email.trim().toLowerCase();
    const displayName = input.primaryContact?.name || input.displayName;
    const userResult = await client.query<{ id: string }>(
      `
        insert into public.users (
          email,
          email_normalized,
          display_name,
          phone,
          status
        )
        values ($1, $1, $2, nullif($3, ''), 'active')
        returning id::text
      `,
      [portalEmail, displayName, input.portalAccess.phone ?? ""],
    ).catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: "CLIENT_PORTAL_EMAIL_EXISTS",
          message: "This email is already associated with an existing account.",
        });
      }
      throw error;
    });
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new ConflictException({ code: "CLIENT_PORTAL_CREATE_FAILED", message: "Client portal user could not be created." });

    const membershipResult = await client.query<{ id: string }>(
      `
        insert into public.tenant_memberships (
          tenant_id,
          user_id,
          display_name,
          status
        )
        values ($1, $2, $3, 'active')
        returning id::text
      `,
      [context.tenantId, userId, displayName],
    );
    const membershipId = membershipResult.rows[0]?.id;
    if (!membershipId) throw new ConflictException({ code: "CLIENT_PORTAL_CREATE_FAILED", message: "Client portal membership could not be created." });

    await client.query(
      `
        insert into public.membership_roles (
          tenant_id,
          membership_id,
          role_id,
          assigned_by_membership_id,
          status
        )
        select $1, $2, r.id, $3, 'active'
        from public.roles r
        where r.code = 'CLIENT_USER'
        returning id
      `,
      [context.tenantId, membershipId, context.membershipId],
    ).then((result) => {
      if (!result.rowCount) {
        throw new ConflictException({ code: "CLIENT_USER_ROLE_MISSING", message: "Client user role is not configured." });
      }
    });

    const clientAccountId = await client.query<{ id: string }>(
      `
        insert into public.client_portal_accounts (
          tenant_id,
          client_id,
          user_id,
          membership_id,
          email,
          email_normalized,
          phone,
          status,
          created_by_membership_id
        )
        values ($1, $2, $3, $4, $5, $5, nullif($6, ''), 'active', $7)
        returning id::text
      `,
      [
        context.tenantId,
        clientId,
        userId,
        membershipId,
        portalEmail,
        input.portalAccess.phone ?? "",
        context.membershipId,
      ],
    ).then((result) => {
      const clientAccountId = result.rows[0]?.id;
      if (!clientAccountId) throw new ConflictException({ code: "CLIENT_PORTAL_CREATE_FAILED", message: "Client portal account could not be created." });
      return clientAccountId;
    });

    await client.query(
      `insert into authn.credentials (portal_type, user_id, tenant_id, client_account_id, email, email_normalized, password_hash, status, password_changed_at)
       values ('CLIENT', $1::uuid, $2::uuid, $3::uuid, $4, $4, $5, 'ACTIVE', now())`,
      [userId, context.tenantId, clientAccountId, portalEmail, passwordHash],
    );

    await client.query(
      "select audit.write_audit_event('CLIENT_PORTAL_ACCOUNT_CREATED', 'client', $1::uuid, 'succeeded', null, $2::jsonb)",
      [clientId, JSON.stringify({ clientId, userId, membershipId, email: portalEmail })],
    );
  }

  private async getEngagements(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select e.id::text, e.name, e.code, s.name as service, e.start_date::text as "startDate",
          coalesce(e.end_date::text, 'Ongoing') as "endDate",
          case when e.status = 'paused' then 'on-hold' when e.status = 'completed' then 'complete' when e.status = 'draft' then 'planning' else 'active' end as status,
          'medium' as priority, 'standard' as complexity,
          case when count(t.id) filter (where t.sla_status in ('near_breach', 'breached')) > 0 then 'at-risk' when count(t.id) filter (where t.status not in ('completed', 'cancelled')) > 0 then 'watch' else 'on-track' end as "slaStatus",
          coalesce(
            (array_agg(distinct tm.display_name order by tm.display_name) filter (where tm.display_name is not null))[1],
            max(coalesce(assigned_tm.display_name, assigned_u.display_name, assigned_emp.employee_code)),
            'Unassigned'
          ) as manager,
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
        left join public.engagement_service_configurations esc
          on esc.tenant_id = e.tenant_id and esc.engagement_id = e.id and esc.status = 'active'
        left join public.employees assigned_emp
          on assigned_emp.id = esc.assigned_employee_id and assigned_emp.tenant_id = e.tenant_id
        left join public.tenant_memberships assigned_tm
          on assigned_tm.id = assigned_emp.membership_id and assigned_tm.tenant_id = e.tenant_id
        left join public.users assigned_u on assigned_u.id = assigned_tm.user_id
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

  private async getRateItems(client: PoolClient, tenantId: string, clientId: string) {
    const result = await client.query(
      `
        select
          rci.id::text,
          rc.name as "rateCardName",
          s.name as service,
          rci.task_type as "taskType",
          rci.unit_type as "billingUnit",
          rci.rate_amount::float as "rateAmount",
          rc.currency_code as "currencyCode",
          rci.tax_code as "taxCode",
          rc.effective_from::text as "effectiveFrom",
          rc.effective_to::text as "effectiveTo",
          case when rci.status = 'archived' then 'archived' else 'active' end as status,
          count(distinct t.id)::int as "tasksUsingRate"
        from public.rate_card_items rci
        join public.rate_cards rc
          on rc.id = rci.rate_card_id
         and rc.tenant_id = rci.tenant_id
        join public.services s
          on s.id = rci.service_id
         and s.tenant_id = rci.tenant_id
        left join public.tasks t
          on t.rate_card_item_id = rci.id
         and t.tenant_id = rci.tenant_id
         and t.client_id = $2
        where rci.tenant_id = $1
          and (rc.client_id = $2 or rc.client_id is null)
          and rc.status = 'active'
          and rci.status in ('active', 'archived')
        group by rci.id, rc.name, s.name, rci.task_type, rci.unit_type, rci.rate_amount, rc.currency_code, rci.tax_code, rc.effective_from, rc.effective_to, rci.status
        order by rci.status asc, s.name asc, rci.task_type asc
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

function normalizeClientCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, "-");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
