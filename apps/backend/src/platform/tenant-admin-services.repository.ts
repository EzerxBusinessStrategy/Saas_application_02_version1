import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { TenantAdminServiceCreateRequest, TenantAdminServiceDto, TenantAdminServiceRateDto } from "./tenant-admin-services.dto";

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
                  'clientName', c.display_name,
                  'taskType', rci.task_type,
                  'unitType', rci.unit_type,
                  'rateAmount', rci.rate_amount::float,
                  'currencyCode', rc.currency_code,
                  'taxCode', rci.tax_code,
                  'tasksUsingRate', coalesce(rt.tasks_using_rate, 0)
                )
                order by rc.client_id nulls first, rci.task_type asc, rci.rate_amount asc
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
      return result.rows;
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
                'tasksUsingRate', 0
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
