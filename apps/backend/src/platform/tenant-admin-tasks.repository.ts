import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { CreateTenantAdminTaskRequest } from "./tenant-admin-tasks.dto";

export type TenantAdminTaskOption = {
  readonly id: string;
  readonly name: string;
};

export type TenantAdminEmployeeOption = TenantAdminTaskOption & {
  readonly employeeCode: string | null;
};

export type TenantAdminWorkGroupOption = TenantAdminTaskOption & {
  readonly clientId: string | null;
};

export type TenantAdminRateCardItemOption = {
  readonly id: string;
  readonly clientId: string | null;
  readonly serviceId: string;
  readonly label: string;
  readonly taskType: string;
  readonly unitType: "per_task" | "per_hour" | "per_filing" | "per_unit";
  readonly rateAmount: number;
  readonly currencyCode: string;
  readonly taxCode: string | null;
};

export type TenantAdminTaskRow = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly clientId: string;
  readonly clientName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly workGroupId: string | null;
  readonly workGroupName: string | null;
  readonly priority: "low" | "normal" | "high" | "urgent";
  readonly status:
    | "draft"
    | "requested"
    | "open"
    | "assigned"
    | "in_progress"
    | "submitted"
    | "manager_review"
    | "returned"
    | "tenant_approval"
    | "approved"
    | "completed"
    | "cancelled";
  readonly slaStatus:
    | "not_started"
    | "running"
    | "met"
    | "near_breach"
    | "breached"
    | "not_applicable";
  readonly plannedDueAt: Date | null;
  readonly assigneeCount: number;
  readonly assignees: readonly { readonly id: string; readonly name: string }[];
};

export type TenantAdminTaskOptions = {
  readonly clients: readonly TenantAdminTaskOption[];
  readonly services: readonly TenantAdminTaskOption[];
  readonly employees: readonly TenantAdminEmployeeOption[];
  readonly workGroups: readonly TenantAdminWorkGroupOption[];
  readonly rateItems: readonly TenantAdminRateCardItemOption[];
};

type TaskPricing = {
  readonly rateCardItemId: string;
  readonly quantity: number;
  readonly unitRate: number;
  readonly currencyCode: string;
};

@Injectable()
export class TenantAdminTasksRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getOptions(context: TenantAdminRequestContext): Promise<TenantAdminTaskOptions> {
    return this.withContext(context, async (client) => ({
      clients: await this.getClients(client, context.tenantId),
      services: await this.getServices(client, context.tenantId),
      employees: await this.getEmployees(client, context.tenantId),
      workGroups: await this.getWorkGroups(client, context.tenantId),
      rateItems: await this.getRateItems(client, context.tenantId),
    }));
  }

  async listTasks(context: TenantAdminRequestContext, clientId?: string): Promise<readonly TenantAdminTaskRow[]> {
    return this.withContext(context, (client) => this.getTasks(client, context.tenantId, clientId));
  }

  async createTask(context: TenantAdminRequestContext, input: CreateTenantAdminTaskRequest): Promise<TenantAdminTaskRow> {
    return this.withContext(context, async (client) => {
      const tenant = await this.getTenantProfile(client, context.tenantId);
      if (!tenant?.countryCode) {
        throw new ConflictException({
          code: "TENANT_COUNTRY_REQUIRED",
          message: "Configure the tenant country before creating tasks.",
        });
      }

      const financialYearId = await this.getCurrentFinancialYearId(client, context.tenantId);
      if (!financialYearId) {
        throw new ConflictException({
          code: "CURRENT_FINANCIAL_YEAR_REQUIRED",
          message: "Configure the current financial year before creating tasks.",
        });
      }

      await this.assertClientExists(client, context.tenantId, input.clientId);
      await this.assertServiceExists(client, context.tenantId, input.serviceId);
      if (input.workGroupId) {
        await this.assertWorkGroupExists(client, context.tenantId, input.workGroupId, input.clientId);
      }
      const pricing = await this.resolveBillingRate(client, context, input, tenant.currencyCode ?? "INR");

      const employeeIds = await this.resolveEmployeeIds(client, context.tenantId, input.employeeIds, input.workGroupId);
      const taskResult = await client.query<{ id: string }>(
        `
          insert into public.tasks (
            tenant_id,
            client_id,
            service_id,
            work_group_id,
            country_code,
            financial_year_id,
            title,
            description,
            priority,
            status,
            planned_due_at,
            rate_card_item_id,
            billable_status,
            created_by,
            updated_by
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            nullif($8, ''),
            $9,
            $10,
            $11,
            $12,
            'pending_completion',
            $13,
            $13
          )
          returning id::text
        `,
        [
          context.tenantId,
          input.clientId,
          input.serviceId,
          input.workGroupId ?? null,
          tenant.countryCode,
          financialYearId,
          input.title,
          input.description ?? "",
          input.priority,
          employeeIds.length ? "assigned" : "open",
          input.plannedDueAt ? new Date(input.plannedDueAt) : null,
          pricing.rateCardItemId,
          context.membershipId,
        ],
      );
      const taskId = taskResult.rows[0]?.id;
      if (!taskId) {
        throw new ConflictException({ code: "TASK_CREATE_FAILED", message: "Task could not be created." });
      }

      await this.createPendingBillableEntry(client, context.tenantId, taskId, input.clientId, pricing);

      for (const employeeId of employeeIds) {
        await client.query(
          `
            insert into public.task_assignments (
              tenant_id,
              task_id,
              employee_id,
              assigned_by,
              assignment_source
            )
            values ($1, $2, $3, $4, $5)
            on conflict (tenant_id, task_id, employee_id) do nothing
          `,
          [
            context.tenantId,
            taskId,
            employeeId,
            context.membershipId,
            input.workGroupId && !input.employeeIds.length ? "work_group" : "direct",
          ],
        );
      }

      await client.query(
        "select audit.write_audit_event('TASK_CREATED', 'task', $1::uuid, 'succeeded', null, $2::jsonb)",
        [
          taskId,
          JSON.stringify({
            clientId: input.clientId,
            serviceId: input.serviceId,
            workGroupId: input.workGroupId ?? null,
            assigneeCount: employeeIds.length,
            rateCardItemId: pricing.rateCardItemId,
            rateSource: input.billing.rateSource,
          }),
        ],
      );

      const created = await this.getTasks(client, context.tenantId, input.clientId, taskId);
      if (!created[0]) {
        throw new ConflictException({ code: "TASK_CREATE_FAILED", message: "Task could not be loaded after creation." });
      }
      return created[0];
    });
  }

  private async getClients(client: PoolClient, tenantId: string): Promise<readonly TenantAdminTaskOption[]> {
    const result = await client.query<{ id: string; name: string }>(
      `
        select id::text, display_name as name
        from public.clients
        where tenant_id = $1
          and status = 'active'
        order by display_name asc
      `,
      [tenantId],
    );
    return result.rows;
  }

  private async getServices(client: PoolClient, tenantId: string): Promise<readonly TenantAdminTaskOption[]> {
    const result = await client.query<{ id: string; name: string }>(
      `
        select id::text, name
        from public.services
        where tenant_id = $1
          and status = 'active'
        order by name asc
      `,
      [tenantId],
    );
    return result.rows;
  }

  private async getEmployees(client: PoolClient, tenantId: string): Promise<readonly TenantAdminEmployeeOption[]> {
    const result = await client.query<{ id: string; name: string; employee_code: string | null }>(
      `
        select
          e.id::text,
          coalesce(tm.display_name, e.employee_code) as name,
          e.employee_code
        from public.employees e
        join public.tenant_memberships tm
          on tm.id = e.membership_id
         and tm.tenant_id = e.tenant_id
        where e.tenant_id = $1
          and e.employment_status = 'active'
        order by coalesce(tm.display_name, e.employee_code) asc
      `,
      [tenantId],
    );
    return result.rows.map((row) => ({ id: row.id, name: row.name, employeeCode: row.employee_code }));
  }

  private async getWorkGroups(client: PoolClient, tenantId: string): Promise<readonly TenantAdminWorkGroupOption[]> {
    const result = await client.query<{ id: string; name: string; client_id: string | null }>(
      `
        select id::text, name, client_id::text
        from public.work_groups
        where tenant_id = $1
          and status = 'active'
        order by name asc
      `,
      [tenantId],
    );
    return result.rows.map((row) => ({ id: row.id, name: row.name, clientId: row.client_id }));
  }

  private async getRateItems(client: PoolClient, tenantId: string): Promise<readonly TenantAdminRateCardItemOption[]> {
    const result = await client.query<{
      id: string;
      client_id: string | null;
      service_id: string;
      task_type: string;
      unit_type: TenantAdminRateCardItemOption["unitType"];
      rate_amount: string;
      currency_code: string;
      tax_code: string | null;
    }>(
      `
        select
          rci.id::text,
          rc.client_id::text,
          rci.service_id::text,
          rci.task_type,
          rci.unit_type,
          rci.rate_amount,
          rc.currency_code,
          rci.tax_code
        from public.rate_card_items rci
        join public.rate_cards rc
          on rc.id = rci.rate_card_id
         and rc.tenant_id = rci.tenant_id
        where rci.tenant_id = $1
          and rci.status = 'active'
          and rc.status = 'active'
          and current_date between rc.effective_from and coalesce(rc.effective_to, '9999-12-31'::date)
        order by rc.client_id nulls last, rci.task_type asc, rci.rate_amount asc
      `,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      serviceId: row.service_id,
      taskType: row.task_type,
      unitType: row.unit_type,
      rateAmount: Number(row.rate_amount),
      currencyCode: row.currency_code,
      taxCode: row.tax_code,
      label: `${row.task_type} - ${formatCurrency(Number(row.rate_amount), row.currency_code)} ${unitLabel(row.unit_type)}`,
    }));
  }

  private async getTenantProfile(
    client: PoolClient,
    tenantId: string,
  ): Promise<{ readonly countryCode: string | null; readonly currencyCode: string | null } | null> {
    const result = await client.query<{ country_code: string | null; currency_code: string | null }>(
      "select country as country_code, currency as currency_code from public.tenants where id = $1",
      [tenantId],
    );
    return result.rows[0] ? { countryCode: result.rows[0].country_code, currencyCode: result.rows[0].currency_code } : null;
  }

  private async resolveBillingRate(
    client: PoolClient,
    context: TenantAdminRequestContext,
    input: CreateTenantAdminTaskRequest,
    defaultCurrencyCode: string,
  ): Promise<TaskPricing> {
    if (input.billing.rateSource === "existing") {
      const result = await client.query<{ id: string; rate_amount: string; currency_code: string }>(
        `
          select rci.id::text, rci.rate_amount, rc.currency_code
          from public.rate_card_items rci
          join public.rate_cards rc
            on rc.id = rci.rate_card_id
           and rc.tenant_id = rci.tenant_id
          where rci.tenant_id = $1
            and rci.id = $2
            and rci.service_id = $3
            and rci.status = 'active'
            and rc.status = 'active'
            and (rc.client_id = $4 or rc.client_id is null)
            and current_date between rc.effective_from and coalesce(rc.effective_to, '9999-12-31'::date)
          order by rc.client_id nulls last
          limit 1
        `,
        [context.tenantId, input.billing.rateCardItemId, input.serviceId, input.clientId],
      );
      if (!result.rows[0]) {
        throw new BadRequestException({ code: "RATE_NOT_AVAILABLE", message: "Select an active rate for this client and service." });
      }
      return {
        rateCardItemId: result.rows[0].id,
        quantity: input.billing.quantity,
        unitRate: Number(result.rows[0].rate_amount),
        currencyCode: result.rows[0].currency_code,
      };
    }

    const rateCardId = await this.getOrCreateRateCard(
      client,
      context,
      input.clientId,
      input.billing.currencyCode || defaultCurrencyCode,
      input.billing.effectiveFrom,
    );
    const inserted = await client.query<{ id: string }>(
      `
        insert into public.rate_card_items (
          tenant_id, rate_card_id, service_id, task_type, unit_type, rate_amount, tax_code, status
        )
        values ($1, $2, $3, $4, $5, $6, nullif($7, ''), $8)
        returning id::text
      `,
      [
        context.tenantId,
        rateCardId,
        input.serviceId,
        input.billing.taskType,
        input.billing.unitType,
        input.billing.rateAmount,
        input.billing.taxCode ?? "",
        input.billing.saveToRateCard ? "active" : "archived",
      ],
    );
    const rateCardItemId = inserted.rows[0]?.id;
    if (!rateCardItemId) throw new ConflictException({ code: "RATE_CREATE_FAILED", message: "Rate could not be created." });

    await client.query(
      "select audit.write_audit_event('RATE_CARD_ITEM_CREATED_FROM_TASK', 'rate_card_item', $1::uuid, 'succeeded', null, $2::jsonb)",
      [
        rateCardItemId,
        JSON.stringify({
          clientId: input.clientId,
          serviceId: input.serviceId,
          taskType: input.billing.taskType,
          rateAmount: input.billing.rateAmount,
          currencyCode: input.billing.currencyCode,
          saveToRateCard: input.billing.saveToRateCard,
          oneTimeReason: input.billing.oneTimeReason || null,
        }),
      ],
    );
    return {
      rateCardItemId,
      quantity: input.billing.quantity,
      unitRate: input.billing.rateAmount,
      currencyCode: input.billing.currencyCode || defaultCurrencyCode,
    };
  }

  private async createPendingBillableEntry(
    client: PoolClient,
    tenantId: string,
    taskId: string,
    clientId: string,
    pricing: TaskPricing,
  ): Promise<void> {
    const grossAmount = pricing.quantity * pricing.unitRate;
    await client.query(
      `
        insert into public.billable_task_entries (
          tenant_id,
          task_id,
          client_id,
          rate_card_item_id,
          currency_code,
          quantity,
          unit_rate,
          gross_amount,
          discount_type,
          discount_value,
          discount_amount,
          tax_amount,
          net_amount,
          status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, null, null, 0, 0, $8, 'pending_completion')
      `,
      [
        tenantId,
        taskId,
        clientId,
        pricing.rateCardItemId,
        pricing.currencyCode,
        pricing.quantity,
        pricing.unitRate,
        grossAmount,
      ],
    );
  }

  private async getOrCreateRateCard(
    client: PoolClient,
    context: TenantAdminRequestContext,
    clientId: string,
    currencyCode: string,
    effectiveFrom: string,
  ): Promise<string> {
    const existing = await client.query<{ id: string }>(
      `
        select id::text
        from public.rate_cards
        where tenant_id = $1
          and client_id = $2
          and currency_code = $3
          and status = 'active'
        order by effective_from desc
        limit 1
      `,
      [context.tenantId, clientId, currencyCode],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const clientRow = await client.query<{ name: string }>(
      "select display_name as name from public.clients where tenant_id = $1 and id = $2",
      [context.tenantId, clientId],
    );
    const inserted = await client.query<{ id: string }>(
      `
        insert into public.rate_cards (
          tenant_id, client_id, name, country_code, currency_code, effective_from, created_by
        )
        values ($1, $2, $3, null, $4, $5, $6)
        returning id::text
      `,
      [
        context.tenantId,
        clientId,
        `Default Rate Card - ${clientRow.rows[0]?.name ?? "Client"}`,
        currencyCode,
        effectiveFrom,
        context.membershipId,
      ],
    );
    const rateCardId = inserted.rows[0]?.id;
    if (!rateCardId) throw new ConflictException({ code: "RATE_CARD_CREATE_FAILED", message: "Rate card could not be created." });
    return rateCardId;
  }

  private async getCurrentFinancialYearId(client: PoolClient, tenantId: string): Promise<string | null> {
    const result = await client.query<{ id: string }>(
      `
        select id::text
        from public.tenant_financial_years
        where tenant_id = $1
          and status <> 'cancelled'
          and current_date between start_date and end_date
        order by start_date desc
        limit 1
      `,
      [tenantId],
    );
    return result.rows[0]?.id ?? null;
  }

  private async assertClientExists(client: PoolClient, tenantId: string, clientId: string): Promise<void> {
    const result = await client.query("select 1 from public.clients where tenant_id = $1 and id = $2 and status = 'active'", [
      tenantId,
      clientId,
    ]);
    if (!result.rowCount) {
      throw new BadRequestException({ code: "CLIENT_NOT_AVAILABLE", message: "Select an active client for this tenant." });
    }
  }

  private async assertServiceExists(client: PoolClient, tenantId: string, serviceId: string): Promise<void> {
    const result = await client.query("select 1 from public.services where tenant_id = $1 and id = $2 and status = 'active'", [
      tenantId,
      serviceId,
    ]);
    if (!result.rowCount) {
      throw new BadRequestException({ code: "SERVICE_NOT_AVAILABLE", message: "Select an active service for this tenant." });
    }
  }

  private async assertWorkGroupExists(
    client: PoolClient,
    tenantId: string,
    workGroupId: string,
    clientId: string,
  ): Promise<void> {
    const result = await client.query(
      `
        select 1
        from public.work_groups
        where tenant_id = $1
          and id = $2
          and status = 'active'
          and (client_id is null or client_id = $3)
      `,
      [tenantId, workGroupId, clientId],
    );
    if (!result.rowCount) {
      throw new BadRequestException({ code: "WORK_GROUP_NOT_AVAILABLE", message: "Select an active work group for this client." });
    }
  }

  private async resolveEmployeeIds(
    client: PoolClient,
    tenantId: string,
    requestedEmployeeIds: readonly string[],
    workGroupId?: string,
  ): Promise<readonly string[]> {
    const uniqueRequested = [...new Set(requestedEmployeeIds)];
    if (uniqueRequested.length) {
      const result = await client.query<{ id: string }>(
        `
          select id::text
          from public.employees
          where tenant_id = $1
            and employment_status = 'active'
            and id = any($2::uuid[])
        `,
        [tenantId, uniqueRequested],
      );
      if (result.rows.length !== uniqueRequested.length) {
        throw new BadRequestException({
          code: "EMPLOYEE_NOT_AVAILABLE",
          message: "One or more selected employees are not active in this tenant.",
        });
      }
      return result.rows.map((row) => row.id);
    }

    if (!workGroupId) return [];

    const result = await client.query<{ employee_id: string }>(
      `
        select wgm.employee_id::text
        from public.work_group_memberships wgm
        join public.employees e
          on e.id = wgm.employee_id
         and e.tenant_id = wgm.tenant_id
         and e.employment_status = 'active'
        where wgm.tenant_id = $1
          and wgm.work_group_id = $2
          and wgm.status = 'active'
        order by wgm.joined_at asc
      `,
      [tenantId, workGroupId],
    );
    return result.rows.map((row) => row.employee_id);
  }

  private async getTasks(
    client: PoolClient,
    tenantId: string,
    clientId?: string,
    taskId?: string,
  ): Promise<readonly TenantAdminTaskRow[]> {
    const result = await client.query<{
      id: string;
      title: string;
      description: string | null;
      client_id: string;
      client_name: string;
      service_id: string;
      service_name: string;
      work_group_id: string | null;
      work_group_name: string | null;
      priority: TenantAdminTaskRow["priority"];
      status: TenantAdminTaskRow["status"];
      sla_status: TenantAdminTaskRow["slaStatus"];
      planned_due_at: Date | null;
      assignee_count: number;
      assignees: Array<{ id: string; name: string }> | null;
    }>(
      `
        select
          t.id::text,
          t.title,
          t.description,
          t.client_id::text,
          c.display_name as client_name,
          t.service_id::text,
          s.name as service_name,
          t.work_group_id::text,
          wg.name as work_group_name,
          t.priority,
          t.status,
          t.sla_status,
          t.planned_due_at,
          count(distinct ta.employee_id)::int as assignee_count,
          coalesce(
            jsonb_agg(
              distinct jsonb_build_object(
                'id', e.id::text,
                'name', coalesce(tm.display_name, e.employee_code)
              )
            ) filter (where e.id is not null),
            '[]'::jsonb
          ) as assignees
        from public.tasks t
        join public.clients c
          on c.id = t.client_id
         and c.tenant_id = t.tenant_id
        join public.services s
          on s.id = t.service_id
         and s.tenant_id = t.tenant_id
        left join public.work_groups wg
          on wg.id = t.work_group_id
         and wg.tenant_id = t.tenant_id
        left join public.task_assignments ta
          on ta.task_id = t.id
         and ta.tenant_id = t.tenant_id
         and ta.status = 'active'
        left join public.employees e
          on e.id = ta.employee_id
         and e.tenant_id = ta.tenant_id
         and e.employment_status = 'active'
        left join public.tenant_memberships tm
          on tm.id = e.membership_id
         and tm.tenant_id = e.tenant_id
        where t.tenant_id = $1
          and ($2::uuid is null or t.client_id = $2::uuid)
          and ($3::uuid is null or t.id = $3::uuid)
        group by
          t.id,
          t.title,
          t.description,
          t.client_id,
          c.display_name,
          t.service_id,
          s.name,
          t.work_group_id,
          wg.name,
          t.priority,
          t.status,
          t.sla_status,
          t.planned_due_at,
          t.created_at
        order by coalesce(t.planned_due_at, t.created_at) desc
        limit 100
      `,
      [tenantId, clientId ?? null, taskId ?? null],
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      clientId: row.client_id,
      clientName: row.client_name,
      serviceId: row.service_id,
      serviceName: row.service_name,
      workGroupId: row.work_group_id,
      workGroupName: row.work_group_name,
      priority: row.priority,
      status: row.status,
      slaStatus: row.sla_status,
      plannedDueAt: row.planned_due_at,
      assigneeCount: Number(row.assignee_count),
      assignees: row.assignees ?? [],
    }));
  }

  private async withContext<T>(
    context: TenantAdminRequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function formatCurrency(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

function unitLabel(unitType: TenantAdminRateCardItemOption["unitType"]): string {
  if (unitType === "per_hour") return "per hour";
  if (unitType === "per_filing") return "per filing";
  if (unitType === "per_unit") return "per unit";
  return "per task";
}
