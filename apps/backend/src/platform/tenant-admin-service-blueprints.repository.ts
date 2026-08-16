import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { yearlyOccurrenceCount } from "./service-blueprint-recurrence";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import {
  EmployeeServiceCapabilitiesResponseDto,
  ReplaceEmployeeServiceCapabilitiesRequest,
  ServiceBlueprintDto,
  ServiceBlueprintTaskDto,
  UpsertServiceBlueprintRequest,
} from "./tenant-admin-service-blueprints.dto";

@Injectable()
export class TenantAdminServiceBlueprintsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getBlueprint(context: TenantAdminRequestContext, serviceId: string): Promise<ServiceBlueprintDto> {
    return this.withContext(context, async (client) => {
      const blueprint = await this.loadBlueprint(client, context.tenantId, serviceId, "IN", "INR");
      if (!blueprint) {
        throw new NotFoundException({ code: "SERVICE_NOT_AVAILABLE", message: "Select an active service for this tenant." });
      }
      return blueprint;
    });
  }

  async upsertBlueprint(
    context: TenantAdminRequestContext,
    serviceId: string,
    input: UpsertServiceBlueprintRequest,
  ): Promise<ServiceBlueprintDto> {
    return this.withContext(context, async (client) => {
      const service = await client.query<{ id: string; name: string }>(
        "select id::text, name from public.services where tenant_id = $1 and id = $2 and status in ('active', 'inactive')",
        [context.tenantId, serviceId],
      );
      if (!service.rows[0]) {
        throw new NotFoundException({ code: "SERVICE_NOT_AVAILABLE", message: "Select an active service for this tenant." });
      }

      const taskTypes = input.tasks.map((task) => task.taskType);
      if (new Set(taskTypes).size !== taskTypes.length) {
        throw new BadRequestException({ code: "DUPLICATE_TASK_TYPE", message: "Each service task type must be unique." });
      }

      const rateCardId = await this.getOrCreateDefaultRateCard(client, context, input.currencyCode, input.effectiveFrom);
      for (const task of input.tasks) {
        await this.upsertRateItem(client, context.tenantId, rateCardId, serviceId, task);
        await this.upsertCalendarRule(client, context.tenantId, serviceId, input.countryCode, input.effectiveFrom, task);
      }

      await client.query(
        `
          update public.rate_card_items rci
          set status = 'inactive', updated_at = now()
          from public.rate_cards rc
          where rci.tenant_id = $1
            and rci.service_id = $2
            and rci.status = 'active'
            and rc.id = rci.rate_card_id
            and rc.tenant_id = rci.tenant_id
            and rc.client_id is null
            and rci.task_type <> all($3::text[])
            and not exists (
              select 1 from public.tasks t
              where t.tenant_id = rci.tenant_id and t.rate_card_item_id = rci.id
            )
        `,
        [context.tenantId, serviceId, taskTypes],
      );
      await client.query(
        `
          update public.compliance_calendar_rules
          set status = 'inactive', updated_at = now()
          where tenant_id = $1
            and service_id = $2
            and status = 'active'
            and task_type <> all($3::text[])
        `,
        [context.tenantId, serviceId, taskTypes],
      );
      await client.query(
        "update public.services set task_type = $3, updated_at = now() where tenant_id = $1 and id = $2",
        [context.tenantId, serviceId, input.tasks[0]?.taskType ?? null],
      );
      await client.query(
        "select audit.write_audit_event('SERVICE_BLUEPRINT_UPDATED', 'service', $1::uuid, 'succeeded', null, $2::jsonb)",
        [serviceId, JSON.stringify({ taskCount: input.tasks.length, countryCode: input.countryCode })],
      );

      const blueprint = await this.loadBlueprint(client, context.tenantId, serviceId, input.countryCode, input.currencyCode);
      if (!blueprint) {
        throw new ConflictException({ code: "SERVICE_BLUEPRINT_LOAD_FAILED", message: "Service tasks could not be loaded." });
      }
      return blueprint;
    });
  }

  async listEmployeeCapabilities(
    context: TenantAdminRequestContext,
    employeeId: string,
  ): Promise<EmployeeServiceCapabilitiesResponseDto> {
    return this.withContext(context, async (client) => {
      await this.assertEmployee(client, context.tenantId, employeeId);
      return {
        employeeId,
        capabilities: await this.readCapabilities(client, context.tenantId, employeeId),
      };
    });
  }

  async replaceEmployeeCapabilities(
    context: TenantAdminRequestContext,
    employeeId: string,
    input: ReplaceEmployeeServiceCapabilitiesRequest,
  ): Promise<EmployeeServiceCapabilitiesResponseDto> {
    return this.withContext(context, async (client) => {
      await this.assertEmployee(client, context.tenantId, employeeId);
      const uniqueIds = [...new Set(input.serviceIds)];
      if (uniqueIds.length) {
        const found = await client.query<{ id: string }>(
          "select id::text from public.services where tenant_id = $1 and id = any($2::uuid[]) and status = 'active'",
          [context.tenantId, uniqueIds],
        );
        if (found.rowCount !== uniqueIds.length) {
          throw new BadRequestException({ code: "SERVICE_NOT_AVAILABLE", message: "Select active services for this tenant." });
        }
      }

      await client.query(
        `
          update public.employee_service_capabilities
          set status = 'inactive', updated_at = now()
          where tenant_id = $1
            and employee_id = $2
            and status = 'active'
            and not (service_id = any($3::uuid[]))
        `,
        [context.tenantId, employeeId, uniqueIds],
      );
      for (const serviceId of uniqueIds) {
        await client.query(
          `
            insert into public.employee_service_capabilities (tenant_id, employee_id, service_id, status)
            values ($1, $2, $3, 'active')
            on conflict (tenant_id, employee_id, service_id) do update
              set status = 'active', updated_at = now()
          `,
          [context.tenantId, employeeId, serviceId],
        );
      }
      await client.query(
        "select audit.write_audit_event('EMPLOYEE_SERVICE_CAPABILITIES_UPDATED', 'employee', $1::uuid, 'succeeded', null, $2::jsonb)",
        [employeeId, JSON.stringify({ serviceIds: uniqueIds })],
      );
      return {
        employeeId,
        capabilities: await this.readCapabilities(client, context.tenantId, employeeId),
      };
    });
  }

  private async readCapabilities(
    client: PoolClient,
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeServiceCapabilitiesResponseDto["capabilities"]> {
    const result = await client.query<{ service_id: string; service_name: string; status: "active" | "inactive" }>(
      `
        select esc.service_id::text, s.name as service_name, esc.status
        from public.employee_service_capabilities esc
        join public.services s on s.id = esc.service_id and s.tenant_id = esc.tenant_id
        where esc.tenant_id = $1
          and esc.employee_id = $2
          and esc.status = 'active'
        order by lower(s.name)
      `,
      [tenantId, employeeId],
    );
    return result.rows.map((row) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      status: row.status,
    }));
  }

  async loadBlueprint(
    client: PoolClient,
    tenantId: string,
    serviceId: string,
    fallbackCountryCode: string,
    fallbackCurrencyCode: string,
  ): Promise<ServiceBlueprintDto | null> {
    const service = await client.query<{ id: string; name: string; code: string }>(
      "select id::text, name, code from public.services where tenant_id = $1 and id = $2 and status in ('active', 'inactive')",
      [tenantId, serviceId],
    );
    if (!service.rows[0]) return null;

    const rates = await client.query<{
      id: string;
      task_type: string;
      unit_type: ServiceBlueprintTaskDto["unitType"];
      rate_amount: string;
      tax_code: string | null;
      currency_code: string;
    }>(
      `
        select rci.id::text, rci.task_type, rci.unit_type, rci.rate_amount::text, rci.tax_code, rc.currency_code
        from public.rate_card_items rci
        join public.rate_cards rc on rc.id = rci.rate_card_id and rc.tenant_id = rci.tenant_id
        where rci.tenant_id = $1
          and rci.service_id = $2
          and rci.status = 'active'
          and rc.status = 'active'
          and rc.client_id is null
        order by rci.task_type
      `,
      [tenantId, serviceId],
    );
    const rules = await client.query<{
      id: string;
      task_type: string;
      frequency: ServiceBlueprintTaskDto["frequency"];
      due_rule: ServiceBlueprintTaskDto["dueRule"];
      country_code: string;
    }>(
      `
        select id::text, task_type, frequency, due_rule, country_code
        from public.compliance_calendar_rules
        where tenant_id = $1
          and service_id = $2
          and status = 'active'
        order by task_type
      `,
      [tenantId, serviceId],
    );
    const ruleByType = new Map(rules.rows.map((row) => [row.task_type, row]));
    const tasks: ServiceBlueprintTaskDto[] = rates.rows.map((rate) => {
      const rule = ruleByType.get(rate.task_type);
      const frequency = rule?.frequency ?? "monthly";
      return {
        taskType: rate.task_type,
        frequency,
        dueRule: rule?.due_rule ?? { type: "fixed_day_of_month", day: 11 },
        unitType: rate.unit_type,
        rateAmount: Number(rate.rate_amount),
        taxCode: rate.tax_code,
        rateCardItemId: rate.id,
        calendarRuleId: rule?.id ?? null,
        enabled: true,
      };
    });
    const estimatedAnnualTotal = tasks.reduce(
      (sum, task) => sum + task.rateAmount * yearlyOccurrenceCount(task.frequency),
      0,
    );
    return {
      serviceId: service.rows[0].id,
      name: service.rows[0].name,
      code: service.rows[0].code,
      countryCode: rules.rows[0]?.country_code ?? fallbackCountryCode,
      currencyCode: rates.rows[0]?.currency_code ?? fallbackCurrencyCode,
      estimatedAnnualTotal,
      tasks,
    };
  }

  private async upsertRateItem(
    client: PoolClient,
    tenantId: string,
    rateCardId: string,
    serviceId: string,
    task: UpsertServiceBlueprintRequest["tasks"][number],
  ): Promise<void> {
    const existing = await client.query<{ id: string }>(
      `
        select rci.id::text
        from public.rate_card_items rci
        join public.rate_cards rc on rc.id = rci.rate_card_id and rc.tenant_id = rci.tenant_id
        where rci.tenant_id = $1
          and rci.service_id = $2
          and rci.task_type = $3
          and rc.client_id is null
        order by rci.status = 'active' desc, rci.updated_at desc
        limit 1
      `,
      [tenantId, serviceId, task.taskType],
    );
    if (existing.rows[0]) {
      await client.query(
        `
          update public.rate_card_items
          set unit_type = $3, rate_amount = $4, tax_code = nullif($5, ''), status = 'active', updated_at = now()
          where tenant_id = $1 and id = $2
        `,
        [tenantId, existing.rows[0].id, task.unitType, task.rateAmount, task.taxCode],
      );
      return;
    }
    await client.query(
      `
        insert into public.rate_card_items (
          tenant_id, rate_card_id, service_id, task_type, unit_type, rate_amount, tax_code, status
        )
        values ($1, $2, $3, $4, $5, $6, nullif($7, ''), 'active')
      `,
      [tenantId, rateCardId, serviceId, task.taskType, task.unitType, task.rateAmount, task.taxCode],
    );
  }

  private async upsertCalendarRule(
    client: PoolClient,
    tenantId: string,
    serviceId: string,
    countryCode: string,
    effectiveFrom: string,
    task: UpsertServiceBlueprintRequest["tasks"][number],
  ): Promise<void> {
    const existing = await client.query<{ id: string }>(
      `
        select id::text
        from public.compliance_calendar_rules
        where tenant_id = $1
          and service_id = $2
          and task_type = $3
          and country_code = $4
        order by status = 'active' desc, updated_at desc
        limit 1
      `,
      [tenantId, serviceId, task.taskType, countryCode],
    );
    if (existing.rows[0]) {
      await client.query(
        `
          update public.compliance_calendar_rules
          set name = $3, frequency = $4, due_rule = $5::jsonb, status = 'active', updated_at = now()
          where tenant_id = $1 and id = $2
        `,
        [tenantId, existing.rows[0].id, task.taskType, task.frequency, JSON.stringify(task.dueRule)],
      );
      return;
    }
    await client.query(
      `
        insert into public.compliance_calendar_rules (
          tenant_id, country_code, service_id, task_type, name, frequency, due_rule, effective_from, status
        )
        values ($1, $2, $3, $4, $4, $5, $6::jsonb, $7::date, 'active')
      `,
      [tenantId, countryCode, serviceId, task.taskType, task.frequency, JSON.stringify(task.dueRule), effectiveFrom],
    );
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
    if (!rateCardId) throw new ConflictException({ code: "RATE_CARD_CREATE_FAILED", message: "Rate card could not be created." });
    return rateCardId;
  }

  private async assertEmployee(client: PoolClient, tenantId: string, employeeId: string): Promise<void> {
    const result = await client.query(
      "select 1 from public.employees where tenant_id = $1 and id = $2 and employment_status in ('active', 'on_leave')",
      [tenantId, employeeId],
    );
    if (!result.rowCount) {
      throw new BadRequestException({ code: "EMPLOYEE_NOT_AVAILABLE", message: "Select an available employee for this tenant." });
    }
  }

  private async withContext<T>(context: TenantAdminRequestContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}
