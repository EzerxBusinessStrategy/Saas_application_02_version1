import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import {
  TenantAdminServiceAllocationsResponseDto,
  TenantAdminServiceCreateRequest,
  TenantAdminServiceDto,
  TenantAdminServiceRateDto,
  TenantAdminServiceTaskStatusResponseDto,
} from "./tenant-admin-services.dto";

type ServiceAllocationRow = {
  readonly rate_item_id: string;
  readonly task_type: string;
  readonly rate_amount: number;
  readonly currency_code: string;
  readonly unit_type: TenantAdminServiceRateDto["unitType"];
  readonly task_id: string | null;
  readonly task_title: string | null;
  readonly task_status: string | null;
  readonly client_id: string | null;
  readonly client_name: string | null;
  readonly employee_id: string | null;
  readonly employee_name: string | null;
  readonly assignment_status: string | null;
};

@Injectable()
export class TenantAdminServicesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(context: TenantAdminRequestContext): Promise<readonly TenantAdminServiceDto[]> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{
        id: string;
        name: string;
        code: string;
        status: "active" | "inactive" | "archived";
        rates: (TenantAdminServiceRateDto & { updatedAt: string })[];
      }>(
        `
          select
            s.id::text,
            s.name,
            s.code,
            s.status,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', rci.id::text,
                  'rateCardName', rc.name,
                  'clientName', c.display_name,
                  'taskType', rci.task_type,
                  'unitType', rci.unit_type,
                  'rateAmount', rci.rate_amount::float,
                  'currencyCode', rc.currency_code,
                  'taxCode', rci.tax_code,
                  'tasksUsingRate', coalesce(rt.tasks_using_rate, 0),
                  'status', rci.status,
                  'updatedAt', rci.updated_at
                )
                order by rc.client_id nulls first, rci.task_type asc, rci.rate_amount asc
              ) filter (
                where rci.id is not null
                  and rc.id is not null
                  and (rci.status = 'active' or rc.client_id is null)
              ),
              '[]'::jsonb
            ) as rates
          from public.services s
          left join public.rate_card_items rci
            on rci.service_id = s.id
           and rci.tenant_id = s.tenant_id
           and rci.status in ('active', 'inactive')
          left join public.rate_cards rc
            on rc.id = rci.rate_card_id
           and rc.tenant_id = rci.tenant_id
           and rc.status = 'active'
          left join public.clients c
            on c.id = rc.client_id
           and c.tenant_id = rc.tenant_id
          left join lateral (
            select count(*)::int as tasks_using_rate
            from public.tasks t
            where t.tenant_id = rci.tenant_id
              and t.rate_card_item_id = rci.id
          ) rt on true
          where s.tenant_id = $1
            and s.status in ('active', 'inactive')
          group by s.id, s.name, s.code, s.status
          order by s.status asc, s.name asc
        `,
        [context.tenantId],
      );
      return result.rows.map((row) => ({ ...row, rates: dedupeRates(row.rates) }));
    });
  }

  async setRateItemStatus(
    context: TenantAdminRequestContext,
    serviceId: string,
    rateItemId: string,
    status: "active" | "inactive",
  ): Promise<TenantAdminServiceTaskStatusResponseDto> {
    return this.withContext(context, async (client) => {
      const found = await client.query<{ id: string; task_type: string }>(
        `
          select rci.id::text, rci.task_type
          from public.rate_card_items rci
          join public.rate_cards rc on rc.id = rci.rate_card_id and rc.tenant_id = rci.tenant_id
          where rci.tenant_id = $1
            and rci.id = $2
            and rci.service_id = $3
            and rc.client_id is null
          for update of rci
        `,
        [context.tenantId, rateItemId, serviceId],
      );
      const item = found.rows[0];
      if (!item) {
        throw new NotFoundException({ code: "SERVICE_TASK_NOT_AVAILABLE", message: "Select a task from this tenant service." });
      }
      await client.query(
        "update public.rate_card_items set status = $3, updated_at = now() where tenant_id = $1 and id = $2",
        [context.tenantId, rateItemId, status],
      );
      await client.query(
        `
          update public.compliance_calendar_rules
          set status = $4, updated_at = now()
          where tenant_id = $1
            and service_id = $2
            and task_type = $3
            and status <> $4
        `,
        [context.tenantId, serviceId, item.task_type, status],
      );
      await client.query(
        "select audit.write_audit_event('SERVICE_TASK_STATUS_UPDATED', 'service', $1::uuid, 'succeeded', null, $2::jsonb)",
        [serviceId, JSON.stringify({ rateItemId, taskType: item.task_type, status })],
      );
      return { rateItemId, taskType: item.task_type, status };
    });
  }

  async getAllocations(
    context: TenantAdminRequestContext,
    serviceId: string,
    rateItemId?: string,
  ): Promise<TenantAdminServiceAllocationsResponseDto> {
    return this.withContext(context, async (client) => {
      const service = await client.query<{ id: string; name: string }>(
        `
          select s.id::text, s.name
          from public.services s
          where s.tenant_id = $1
            and s.id = $2
            and s.status in ('active', 'inactive')
        `,
        [context.tenantId, serviceId],
      );
      const serviceRow = service.rows[0];
      if (!serviceRow) {
        throw new NotFoundException({ code: "SERVICE_NOT_FOUND", message: "Select a service from this tenant." });
      }

      const result = await client.query<ServiceAllocationRow>(
        `
          select
            rci.id::text as rate_item_id,
            rci.task_type,
            rci.rate_amount::float as rate_amount,
            rc.currency_code,
            rci.unit_type,
            t.id::text as task_id,
            t.title as task_title,
            t.status as task_status,
            c.id::text as client_id,
            c.display_name as client_name,
            e.id::text as employee_id,
            coalesce(tm.display_name, e.employee_code) as employee_name,
            ta.status as assignment_status
          from public.rate_card_items rci
          join public.rate_cards rc
            on rc.id = rci.rate_card_id
           and rc.tenant_id = rci.tenant_id
           and rc.status = 'active'
          left join public.tasks t
            on t.tenant_id = rci.tenant_id
           and t.rate_card_item_id = rci.id
           and t.status <> 'cancelled'
          left join public.clients c
            on c.tenant_id = t.tenant_id
           and c.id = t.client_id
          left join public.task_assignments ta
            on ta.tenant_id = t.tenant_id
           and ta.task_id = t.id
           and ta.status in ('active', 'submitted')
          left join public.employees e
            on e.tenant_id = ta.tenant_id
           and e.id = ta.employee_id
          left join public.tenant_memberships tm
            on tm.tenant_id = e.tenant_id
           and tm.id = e.membership_id
          where rci.tenant_id = $1
            and rci.service_id = $2
            and ($3::uuid is null or rci.id = $3)
          order by rci.task_type asc, c.display_name asc nulls last, t.title asc nulls last, employee_name asc nulls last
        `,
        [context.tenantId, serviceId, rateItemId ?? null],
      );

      return {
        serviceId: serviceRow.id,
        serviceName: serviceRow.name,
        rateItems: groupServiceAllocations(result.rows),
      };
    });
  }

  async create(context: TenantAdminRequestContext, input: TenantAdminServiceCreateRequest): Promise<TenantAdminServiceDto> {
    return this.withContext(context, async (client) => {
      const code = normalizeServiceCode(input.name);
      const existing = await client.query(
        "select 1 from public.services where tenant_id = $1 and code = $2",
        [context.tenantId, code],
      );
      if (existing.rowCount) {
        throw new ConflictException({ code: "SERVICE_ALREADY_EXISTS", message: "A service with this name already exists." });
      }

      const inserted = await client.query<{ id: string }>(
        `
          insert into public.services (tenant_id, code, name, task_type, default_billing_model)
          values ($1, $2, $3, $4, $5)
          returning id::text
        `,
        [context.tenantId, code, input.name, input.taskType, defaultBillingModel(input.unitType)],
      );
      const serviceId = inserted.rows[0]?.id;
      if (!serviceId) {
        throw new ConflictException({ code: "SERVICE_CREATE_FAILED", message: "Service could not be created." });
      }

      const rateCardId = await this.getOrCreateDefaultRateCard(client, context, input.currencyCode, input.effectiveFrom);
      await client.query(
        `
          insert into public.rate_card_items (
            tenant_id, rate_card_id, service_id, task_type, unit_type, rate_amount, tax_code, status
          )
          values ($1, $2, $3, $4, $5, $6, nullif($7, ''), 'active')
        `,
        [context.tenantId, rateCardId, serviceId, input.taskType, input.unitType, input.rateAmount, input.taxCode],
      );

      await client.query(
        "select audit.write_audit_event('SERVICE_CREATED', 'service', $1::uuid, 'succeeded', null, $2::jsonb)",
        [serviceId, { name: input.name, rateAmount: input.rateAmount, currencyCode: input.currencyCode }],
      );

      const service = await this.getService(client, context.tenantId, serviceId);
      if (!service) {
        throw new ConflictException({ code: "SERVICE_LOAD_FAILED", message: "Service could not be loaded after creation." });
      }
      return service;
    });
  }

  private async getOrCreateDefaultRateCard(
    client: PoolClient,
    context: TenantAdminRequestContext,
    currencyCode: string,
    effectiveFrom: string,
  ): Promise<string> {
    const existing = await client.query<{ id: string }>(
      `
        select id::text
        from public.rate_cards
        where tenant_id = $1
          and client_id is null
          and currency_code = $2
          and status = 'active'
          and $3::date between effective_from and coalesce(effective_to, 'infinity'::date)
        order by effective_from desc
        limit 1
      `,
      [context.tenantId, currencyCode, effectiveFrom],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const inserted = await client.query<{ id: string }>(
      `
        insert into public.rate_cards (tenant_id, client_id, name, country_code, currency_code, effective_from, created_by)
        values ($1, null, $2, null, $3, $4, $5)
        returning id::text
      `,
      [context.tenantId, `Default Service Rate Card - ${currencyCode}`, currencyCode, effectiveFrom, context.membershipId],
    );
    const rateCardId = inserted.rows[0]?.id;
    if (!rateCardId) {
      throw new ConflictException({ code: "RATE_CARD_CREATE_FAILED", message: "Rate card could not be created." });
    }
    return rateCardId;
  }

  private async getService(client: PoolClient, tenantId: string, serviceId: string): Promise<TenantAdminServiceDto | null> {
    const result = await client.query<{
      id: string;
      name: string;
      code: string;
      status: "active" | "inactive" | "archived";
      rates: TenantAdminServiceRateDto[];
    }>(
      `
        select
          s.id::text,
          s.name,
          s.code,
          s.status,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', rci.id::text,
                'rateCardName', rc.name,
                'clientName', null,
                'taskType', rci.task_type,
                'unitType', rci.unit_type,
                'rateAmount', rci.rate_amount::float,
                'currencyCode', rc.currency_code,
                'taxCode', rci.tax_code,
                'tasksUsingRate', 0,
                'status', rci.status
              )
            ) filter (where rci.id is not null and rc.id is not null),
            '[]'::jsonb
          ) as rates
        from public.services s
        left join public.rate_card_items rci
          on rci.service_id = s.id
         and rci.tenant_id = s.tenant_id
         and rci.status = 'active'
        left join public.rate_cards rc
          on rc.id = rci.rate_card_id
         and rc.tenant_id = rci.tenant_id
         and rc.status = 'active'
        where s.tenant_id = $1
          and s.id = $2
        group by s.id, s.name, s.code, s.status
      `,
      [tenantId, serviceId],
    );
    return result.rows[0] ?? null;
  }

  private async withContext<T>(context: TenantAdminRequestContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function groupServiceAllocations(rows: readonly ServiceAllocationRow[]): TenantAdminServiceAllocationsResponseDto["rateItems"] {
  const rateItems = new Map<string, TenantAdminServiceAllocationsResponseDto["rateItems"][number]>();

  for (const row of rows) {
    let rateItem = rateItems.get(row.rate_item_id);
    if (!rateItem) {
      rateItem = {
        rateItemId: row.rate_item_id,
        taskType: row.task_type,
        rateAmount: Number(row.rate_amount),
        currencyCode: row.currency_code,
        unitType: row.unit_type,
        tasks: [],
      };
      rateItems.set(row.rate_item_id, rateItem);
    }

    if (!row.task_id || !row.client_id || !row.client_name || !row.task_title || !row.task_status) {
      continue;
    }

    let task = rateItem.tasks.find((item) => item.taskId === row.task_id);
    if (!task) {
      task = {
        taskId: row.task_id,
        taskTitle: row.task_title,
        taskStatus: row.task_status,
        clientId: row.client_id,
        clientName: row.client_name,
        employees: [],
      };
      rateItem.tasks.push(task);
    }

    if (row.employee_id && row.employee_name && row.assignment_status) {
      const exists = task.employees.some((employee) => employee.employeeId === row.employee_id);
      if (!exists) {
        task.employees.push({
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          assignmentStatus: row.assignment_status,
        });
      }
    }
  }

  return [...rateItems.values()];
}

function dedupeRates(rates: readonly (TenantAdminServiceRateDto & { updatedAt: string })[]): TenantAdminServiceRateDto[] {
  const byKey = new Map<string, TenantAdminServiceRateDto & { updatedAt: string }>();
  for (const rate of rates) {
    const key = `${rate.clientName ?? ""}|${rate.taskType.toLowerCase()}`;
    const existing = byKey.get(key);
    const winsOverExisting =
      !existing ||
      (rate.status === "active" && existing.status !== "active") ||
      (rate.status === existing.status && rate.updatedAt > existing.updatedAt);
    if (winsOverExisting) byKey.set(key, rate);
  }
  const kept = new Set([...byKey.values()].map((rate) => rate.id));
  return rates.filter((rate) => kept.has(rate.id)).map(({ updatedAt: _updatedAt, ...rate }) => rate);
}

function normalizeServiceCode(name: string): string {
  const code = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!code) throw new BadRequestException({ code: "SERVICE_CODE_REQUIRED", message: "Enter a valid service name." });
  return code.slice(0, 80);
}

function defaultBillingModel(unitType: TenantAdminServiceCreateRequest["unitType"]): string {
  if (unitType === "per_hour") return "hourly";
  if (unitType === "per_unit") return "per_unit";
  if (unitType === "per_filing") return "fixed";
  return "per_task";
}
