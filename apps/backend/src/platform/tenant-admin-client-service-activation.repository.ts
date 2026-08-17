import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import {
  expandRecurrenceOccurrences,
  yearlyOccurrenceCount,
  type ServiceBlueprintDueRule,
  type ServiceBlueprintFrequency,
} from "./service-blueprint-recurrence";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { TenantAdminServiceBlueprintsRepository } from "./tenant-admin-service-blueprints.repository";
import {
  ActivateClientServicesRequest,
  ActivateClientServicesResponseDto,
  ActivatedClientServiceDto,
  ServiceOnboardingAssigneesResponseDto,
  ServiceOnboardingCatalogResponseDto,
} from "./tenant-admin-client-service-activation.dto";

@Injectable()
export class TenantAdminClientServiceActivationRepository {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool | null,
    @Inject(TenantAdminServiceBlueprintsRepository)
    private readonly blueprints: TenantAdminServiceBlueprintsRepository,
  ) {}

  async getCatalog(context: TenantAdminRequestContext, clientId: string): Promise<ServiceOnboardingCatalogResponseDto> {
    return this.withContext(context, async (client) => {
      const clientRow = await this.requireClient(client, context.tenantId, clientId);
      const services = await client.query<{ id: string }>(
        "select id::text from public.services where tenant_id = $1 and status = 'active' order by lower(name)",
        [context.tenantId],
      );
      const active = await client.query<{ service_id: string }>(
        "select service_id::text from public.engagements where tenant_id = $1 and client_id = $2 and status in ('draft', 'active')",
        [context.tenantId, clientId],
      );
      const activeIds = new Set(active.rows.map((row) => row.service_id));
      const items = [];
      for (const row of services.rows) {
        const blueprint = await this.blueprints.loadBlueprint(client, context.tenantId, row.id, "IN", "INR");
        if (!blueprint || !blueprint.tasks.length) continue;
        items.push({
          serviceId: blueprint.serviceId,
          name: blueprint.name,
          code: blueprint.code,
          estimatedAnnualTotal: blueprint.estimatedAnnualTotal,
          currencyCode: blueprint.currencyCode,
          alreadyActive: activeIds.has(blueprint.serviceId),
          tasks: blueprint.tasks.map((task) => ({
            taskType: task.taskType,
            frequency: task.frequency,
            dueRule: task.dueRule,
            unitType: task.unitType,
            rateAmount: task.rateAmount,
            taxCode: task.taxCode,
            rateCardItemId: task.rateCardItemId,
            calendarRuleId: task.calendarRuleId,
          })),
        });
      }
      return { clientId, clientName: clientRow.name, services: items };
    });
  }

  async listAssignees(
    context: TenantAdminRequestContext,
    clientId: string,
    serviceId: string,
  ): Promise<ServiceOnboardingAssigneesResponseDto> {
    return this.withContext(context, async (client) => {
      await this.requireClient(client, context.tenantId, clientId);
      const service = await client.query("select 1 from public.services where tenant_id = $1 and id = $2 and status = 'active'", [
        context.tenantId,
        serviceId,
      ]);
      if (!service.rowCount) {
        throw new BadRequestException({ code: "SERVICE_NOT_AVAILABLE", message: "Select an active service for this tenant." });
      }
      const result = await client.query<{
        employee_id: string;
        name: string;
        department_name: string | null;
        service_capable: boolean;
        active_tasks: string;
        weekly_capacity_hours: string;
      }>(
        `
          select
            e.id::text as employee_id,
            coalesce(tm.display_name, u.display_name, e.employee_code) as name,
            d.name as department_name,
            exists (
              select 1
              from public.employee_service_capabilities esc
              where esc.tenant_id = e.tenant_id
                and esc.employee_id = e.id
                and esc.service_id = $2
                and esc.status = 'active'
            ) as service_capable,
            (
              select count(*)::int
              from public.task_assignments ta
              join public.tasks t on t.tenant_id = ta.tenant_id and t.id = ta.task_id
              where ta.tenant_id = e.tenant_id
                and ta.employee_id = e.id
                and ta.status = 'active'
                and t.status not in ('completed', 'cancelled')
            )::text as active_tasks,
            coalesce(round(e.default_capacity_minutes_per_week / 60.0), 40)::text as weekly_capacity_hours
          from public.employees e
          join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
          left join public.users u on u.id = tm.user_id
          left join public.departments d
            on d.tenant_id = e.tenant_id
           and d.id = e.department_id
          where e.tenant_id = $1
            and e.employment_status = 'active'
          order by
            exists (
              select 1
              from public.employee_service_capabilities esc
              where esc.tenant_id = e.tenant_id
                and esc.employee_id = e.id
                and esc.service_id = $2
                and esc.status = 'active'
            ) desc,
            active_tasks asc,
            lower(coalesce(tm.display_name, u.display_name, e.employee_code))
        `,
        [context.tenantId, serviceId],
      );
      const capable = result.rows.filter((row) => row.service_capable);
      const rows = capable.length ? capable : result.rows;
      return {
        serviceId,
        employees: rows.map((row) => ({
          employeeId: row.employee_id,
          name: row.name,
          departmentName: row.department_name,
          serviceCapable: row.service_capable,
          activeTasks: Number(row.active_tasks),
          weeklyCapacityHours: Number(row.weekly_capacity_hours),
        })),
      };
    });
  }

  async activate(
    context: TenantAdminRequestContext,
    clientId: string,
    input: ActivateClientServicesRequest,
  ): Promise<ActivateClientServicesResponseDto> {
    return this.withContext(context, (client) => this.activateInTransaction(client, context, clientId, input));
  }

  async activateInTransaction(
    client: PoolClient,
    context: TenantAdminRequestContext,
    clientId: string,
    input: ActivateClientServicesRequest,
  ): Promise<ActivateClientServicesResponseDto> {
    await this.requireClient(client, context.tenantId, clientId);
      const fingerprint = requestFingerprint(clientId, input);
      const replayed = await this.loadByIdempotency(client, context.tenantId, clientId, input.idempotencyKey, fingerprint);
      if (replayed) return replayed;

      const startDate = input.startDate ?? new Date().toISOString().slice(0, 10);
      const financialYear = await this.requireFinancialYear(client, context.tenantId, input.countryCode);
      const activated: ActivatedClientServiceDto[] = [];

      for (const selected of input.services) {
        const enabledTasks = selected.tasks.filter((task) => task.enabled !== false);
        if (!enabledTasks.length) {
          throw new BadRequestException({ code: "SERVICE_TASKS_REQUIRED", message: "Keep at least one task in each selected service." });
        }
        const service = await this.requireService(client, context.tenantId, selected.serviceId);
        await this.requireAssignableEmployee(client, context.tenantId, selected.assignedEmployeeId, selected.serviceId);
        const existing = await this.findActiveEngagement(client, context.tenantId, clientId, selected.serviceId);
        if (existing) {
          activated.push(existing);
          continue;
        }

        const estimatedTotal = enabledTasks.reduce(
          (sum, task) => sum + task.rateAmount * yearlyOccurrenceCount(task.frequency),
          0,
        );
        const engagementId = await this.createEngagement(client, context, clientId, service, startDate, financialYear.endsOn);
        const snapshot = {
          version: 1,
          tasks: enabledTasks.map((task) => ({
            title: task.title?.trim() || task.taskType,
            taskType: task.taskType,
            frequency: task.frequency,
            dueRule: task.dueRule,
            unitType: task.unitType,
            rateAmount: task.rateAmount,
            taxCode: task.taxCode ?? "",
          })),
        };
        await client.query(
          `
            insert into public.engagement_service_configurations (
              tenant_id, engagement_id, service_id, assigned_employee_id, country_code,
              configuration_snapshot, estimated_total, discount_percent, currency_code, status, activated_at,
              idempotency_key, request_fingerprint
            )
            values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, 'active', now(), $10, $11)
          `,
          [
            context.tenantId,
            engagementId,
            selected.serviceId,
            selected.assignedEmployeeId,
            input.countryCode,
            JSON.stringify(snapshot),
            estimatedTotal,
            normalizeDiscountPercent(input.discountPercent),
            input.currencyCode,
            input.idempotencyKey,
            fingerprint,
          ],
        );

        let taskCount = 0;
        for (const task of enabledTasks) {
          const rateCardItemId = await this.resolveRateItem(
            client,
            context,
            clientId,
            selected.serviceId,
            input.currencyCode,
            startDate,
            task,
          );
          const calendarRuleId = await this.findCalendarRuleId(
            client,
            context.tenantId,
            selected.serviceId,
            input.countryCode,
            task.taskType,
            task.frequency,
            task.dueRule,
          );
          const occurrences = expandRecurrenceOccurrences({
            frequency: task.frequency,
            dueRule: task.dueRule,
            horizonStart: financialYear.startsOn,
            horizonEnd: financialYear.endsOn,
            skipBefore: startDate,
          });
          const dueDates = occurrences.length ? occurrences : [{ dueOn: startDate, periodLabel: startDate }];
          for (const occurrence of dueDates) {
            const created = await this.insertGeneratedTask(client, context, {
              clientId,
              serviceId: selected.serviceId,
              engagementId,
              countryCode: input.countryCode,
              financialYearId: financialYear.id,
              calendarRuleId,
              rateCardItemId,
              title: `${task.title?.trim() || task.taskType} (${occurrence.periodLabel})`,
              dueOn: occurrence.dueOn,
              employeeId: selected.assignedEmployeeId,
              unitRate: task.rateAmount,
              currencyCode: input.currencyCode,
            });
            if (created) taskCount += 1;
          }
        }

        const employeeName = await this.employeeName(client, context.tenantId, selected.assignedEmployeeId);
        await client.query(
          "select audit.write_audit_event('SERVICE_ACTIVATED', 'engagement', $1::uuid, 'succeeded', null, $2::jsonb)",
          [
            engagementId,
            JSON.stringify({
              clientId,
              serviceId: selected.serviceId,
              assignedEmployeeId: selected.assignedEmployeeId,
              taskCount,
              estimatedTotal,
            }),
          ],
        );
        await this.notifyActivation(client, context, clientId, engagementId, service.name, selected.assignedEmployeeId, taskCount);
        activated.push({
          engagementId,
          serviceId: selected.serviceId,
          serviceName: service.name,
          assignedEmployeeId: selected.assignedEmployeeId,
          assignedEmployeeName: employeeName,
          taskCount,
          estimatedTotal,
          alreadyActive: false,
        });
      }

      return {
        clientId,
        replayed: false,
        estimatedTotal: activated.reduce((sum, item) => sum + item.estimatedTotal, 0),
        currencyCode: input.currencyCode,
        services: activated,
      };
  }

  private async loadByIdempotency(
    client: PoolClient,
    tenantId: string,
    clientId: string,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<ActivateClientServicesResponseDto | null> {
    const existing = await client.query<{
      engagement_id: string;
      service_id: string;
      service_name: string;
      assigned_employee_id: string;
      assigned_employee_name: string;
      estimated_total: string;
      currency_code: string;
      request_fingerprint: string;
      task_count: string;
    }>(
      `
        select
          esc.engagement_id::text,
          esc.service_id::text,
          s.name as service_name,
          esc.assigned_employee_id::text,
          coalesce(tm.display_name, u.display_name, emp.employee_code) as assigned_employee_name,
          esc.estimated_total::text,
          esc.currency_code,
          esc.request_fingerprint,
          (
            select count(*)::int from public.tasks t
            where t.tenant_id = esc.tenant_id and t.engagement_id = esc.engagement_id and t.status <> 'cancelled'
          )::text as task_count
        from public.engagement_service_configurations esc
        join public.engagements e on e.id = esc.engagement_id and e.tenant_id = esc.tenant_id
        join public.services s on s.id = esc.service_id and s.tenant_id = esc.tenant_id
        join public.employees emp on emp.id = esc.assigned_employee_id and emp.tenant_id = esc.tenant_id
        join public.tenant_memberships tm on tm.id = emp.membership_id and tm.tenant_id = emp.tenant_id
        left join public.users u on u.id = tm.user_id
        where esc.tenant_id = $1
          and esc.idempotency_key = $2
          and e.client_id = $3
        order by s.name
      `,
      [tenantId, idempotencyKey, clientId],
    );
    if (!existing.rowCount) {
      const reused = await client.query(
        "select 1 from public.engagement_service_configurations where tenant_id = $1 and idempotency_key = $2 limit 1",
        [tenantId, idempotencyKey],
      );
      if (reused.rowCount) {
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "This activation request was already used with different services.",
        });
      }
      return null;
    }
    if (existing.rows.some((row) => row.request_fingerprint !== fingerprint)) {
      throw new ConflictException({
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "This activation request was already used with different services.",
      });
    }
    return {
      clientId,
      replayed: true,
      estimatedTotal: existing.rows.reduce((sum, row) => sum + Number(row.estimated_total), 0),
      currencyCode: existing.rows[0]?.currency_code ?? "INR",
      services: existing.rows.map((row) => ({
        engagementId: row.engagement_id,
        serviceId: row.service_id,
        serviceName: row.service_name,
        assignedEmployeeId: row.assigned_employee_id,
        assignedEmployeeName: row.assigned_employee_name,
        taskCount: Number(row.task_count),
        estimatedTotal: Number(row.estimated_total),
        alreadyActive: true,
      })),
    };
  }

  private async findActiveEngagement(
    client: PoolClient,
    tenantId: string,
    clientId: string,
    serviceId: string,
  ): Promise<ActivatedClientServiceDto | null> {
    const result = await client.query<{
      engagement_id: string;
      service_name: string;
      assigned_employee_id: string | null;
      assigned_employee_name: string | null;
      estimated_total: string | null;
      task_count: string;
    }>(
      `
        select
          e.id::text as engagement_id,
          s.name as service_name,
          esc.assigned_employee_id::text,
          coalesce(tm.display_name, u.display_name, emp.employee_code) as assigned_employee_name,
          esc.estimated_total::text,
          (
            select count(*)::int from public.tasks t
            where t.tenant_id = e.tenant_id and t.engagement_id = e.id and t.status <> 'cancelled'
          )::text as task_count
        from public.engagements e
        join public.services s on s.id = e.service_id and s.tenant_id = e.tenant_id
        left join public.engagement_service_configurations esc
          on esc.tenant_id = e.tenant_id and esc.engagement_id = e.id
        left join public.employees emp on emp.id = esc.assigned_employee_id and emp.tenant_id = e.tenant_id
        left join public.tenant_memberships tm on tm.id = emp.membership_id and tm.tenant_id = e.tenant_id
        left join public.users u on u.id = tm.user_id
        where e.tenant_id = $1
          and e.client_id = $2
          and e.service_id = $3
          and e.status in ('draft', 'active')
        limit 1
      `,
      [tenantId, clientId, serviceId],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (!row.assigned_employee_id) {
      throw new ConflictException({
        code: "SERVICE_ALREADY_ACTIVE",
        message: "This client already has an active engagement for the selected service.",
      });
    }
    return {
      engagementId: row.engagement_id,
      serviceId,
      serviceName: row.service_name,
      assignedEmployeeId: row.assigned_employee_id,
      assignedEmployeeName: row.assigned_employee_name ?? "Assigned",
      taskCount: Number(row.task_count),
      estimatedTotal: Number(row.estimated_total ?? 0),
      alreadyActive: true,
    };
  }

  private async createEngagement(
    client: PoolClient,
    context: TenantAdminRequestContext,
    clientId: string,
    service: { id: string; name: string; code: string },
    startDate: string,
    endDate: string,
  ): Promise<string> {
    const base = `${service.code}-${startDate}`.slice(0, 70);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const inserted = await client.query<{ id: string }>(
        `
          insert into public.engagements (
            tenant_id, client_id, service_id, code, name, status, start_date, end_date
          )
          values ($1, $2, $3, $4, $5, 'active', $6::date, $7::date)
          on conflict (tenant_id, code) do nothing
          returning id::text
        `,
        [context.tenantId, clientId, service.id, code, service.name, startDate, endDate],
      );
      if (inserted.rows[0]) return inserted.rows[0].id;
    }
    throw new ConflictException({ code: "ENGAGEMENT_CREATE_FAILED", message: "Service engagement could not be created." });
  }

  private async resolveRateItem(
    client: PoolClient,
    context: TenantAdminRequestContext,
    clientId: string,
    serviceId: string,
    currencyCode: string,
    effectiveFrom: string,
    task: ActivateClientServicesRequest["services"][number]["tasks"][number],
  ): Promise<string> {
    const tenantDefault = await client.query<{ id: string; rate_amount: string }>(
      `
        select rci.id::text, rci.rate_amount::text
        from public.rate_card_items rci
        join public.rate_cards rc on rc.id = rci.rate_card_id and rc.tenant_id = rci.tenant_id
        where rci.tenant_id = $1
          and rci.service_id = $2
          and rci.task_type = $3
          and rci.status = 'active'
          and rc.status = 'active'
          and rc.client_id is null
        order by rc.effective_from desc
        limit 1
      `,
      [context.tenantId, serviceId, task.taskType],
    );
    const defaultAmount = tenantDefault.rows[0] ? Number(tenantDefault.rows[0].rate_amount) : null;
    if (tenantDefault.rows[0] && defaultAmount === task.rateAmount) {
      return tenantDefault.rows[0].id;
    }

    const rateCardId = await this.getOrCreateClientRateCard(client, context, clientId, currencyCode, effectiveFrom);
    const existing = await client.query<{ id: string }>(
      `
        select rci.id::text
        from public.rate_card_items rci
        where rci.tenant_id = $1
          and rci.rate_card_id = $2
          and rci.service_id = $3
          and rci.task_type = $4
        order by rci.status = 'active' desc
        limit 1
      `,
      [context.tenantId, rateCardId, serviceId, task.taskType],
    );
    if (existing.rows[0]) {
      await client.query(
        `
          update public.rate_card_items
          set unit_type = $3, rate_amount = $4, tax_code = nullif($5, ''), status = 'active', updated_at = now()
          where tenant_id = $1 and id = $2
        `,
        [context.tenantId, existing.rows[0].id, task.unitType, task.rateAmount, task.taxCode ?? ""],
      );
      return existing.rows[0].id;
    }
    const inserted = await client.query<{ id: string }>(
      `
        insert into public.rate_card_items (
          tenant_id, rate_card_id, service_id, task_type, unit_type, rate_amount, tax_code, status
        )
        values ($1, $2, $3, $4, $5, $6, nullif($7, ''), 'active')
        returning id::text
      `,
      [context.tenantId, rateCardId, serviceId, task.taskType, task.unitType, task.rateAmount, task.taxCode ?? ""],
    );
    const rateCardItemId = inserted.rows[0]?.id;
    if (!rateCardItemId) throw new ConflictException({ code: "RATE_CREATE_FAILED", message: "Client rate could not be created." });
    return rateCardItemId;
  }

  private async getOrCreateClientRateCard(
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
          and $4::date between effective_from and coalesce(effective_to, 'infinity'::date)
        order by effective_from desc
        limit 1
      `,
      [context.tenantId, clientId, currencyCode, effectiveFrom],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const clientRow = await client.query<{ name: string }>(
      "select display_name as name from public.clients where tenant_id = $1 and id = $2",
      [context.tenantId, clientId],
    );
    const inserted = await client.query<{ id: string }>(
      `
        insert into public.rate_cards (tenant_id, client_id, name, country_code, currency_code, effective_from, created_by)
        values ($1, $2, $3, null, $4, $5, $6)
        returning id::text
      `,
      [
        context.tenantId,
        clientId,
        `Client Service Rate Card - ${clientRow.rows[0]?.name ?? "Client"}`,
        currencyCode,
        effectiveFrom,
        context.membershipId,
      ],
    );
    const rateCardId = inserted.rows[0]?.id;
    if (!rateCardId) throw new ConflictException({ code: "RATE_CARD_CREATE_FAILED", message: "Rate card could not be created." });
    return rateCardId;
  }

  private async findCalendarRuleId(
    client: PoolClient,
    tenantId: string,
    serviceId: string,
    countryCode: string,
    taskType: string,
    frequency: ServiceBlueprintFrequency,
    dueRule: ServiceBlueprintDueRule,
  ): Promise<string | null> {
    const result = await client.query<{ id: string }>(
      `
        select id::text
        from public.compliance_calendar_rules
        where tenant_id = $1
          and service_id = $2
          and country_code = $3
          and task_type = $4
          and frequency = $5
          and due_rule = $6::jsonb
          and status = 'active'
        limit 1
      `,
      [tenantId, serviceId, countryCode, taskType, frequency, JSON.stringify(dueRule)],
    );
    return result.rows[0]?.id ?? null;
  }

  private async insertGeneratedTask(
    client: PoolClient,
    context: TenantAdminRequestContext,
    input: {
      clientId: string;
      serviceId: string;
      engagementId: string;
      countryCode: string;
      financialYearId: string;
      calendarRuleId: string | null;
      rateCardItemId: string;
      title: string;
      dueOn: string;
      employeeId: string;
      unitRate: number;
      currencyCode: string;
    },
  ): Promise<boolean> {
    const dueAt = `${input.dueOn}T00:00:00.000Z`;
    const inserted = await client.query<{ id: string }>(
      `
        insert into public.tasks (
          tenant_id, client_id, service_id, engagement_id, country_code, financial_year_id,
          compliance_calendar_rule_id, rate_card_item_id, title, priority, status, planned_due_at,
          billable_status, created_by, updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'normal', 'assigned', $10::timestamptz, 'pending_completion', $11, $11)
        on conflict do nothing
        returning id::text
      `,
      [
        context.tenantId,
        input.clientId,
        input.serviceId,
        input.engagementId,
        input.countryCode,
        input.financialYearId,
        input.calendarRuleId,
        input.rateCardItemId,
        input.title,
        dueAt,
        context.membershipId,
      ],
    );
    const taskId = inserted.rows[0]?.id;
    if (!taskId) return false;

    await client.query(
      `
        insert into public.task_assignments (tenant_id, task_id, employee_id, assigned_by, assignment_source)
        values ($1, $2, $3, $4, 'direct')
        on conflict (tenant_id, task_id, employee_id) do nothing
      `,
      [context.tenantId, taskId, input.employeeId, context.membershipId],
    );
    const grossAmount = roundMoney(input.unitRate);
    await client.query(
      `
        insert into public.billable_task_entries (
          tenant_id, task_id, client_id, rate_card_item_id, currency_code, quantity, unit_rate,
          gross_amount, discount_type, discount_value, discount_amount, tax_amount, net_amount, status
        )
        values ($1, $2, $3, $4, $5, 1, $6, $7, null, null, 0, 0, $7, 'pending_review')
        on conflict (tenant_id, task_id) where status <> 'cancelled' do nothing
      `,
      [context.tenantId, taskId, input.clientId, input.rateCardItemId, input.currencyCode, input.unitRate, grossAmount],
    );
    return true;
  }

  private async notifyActivation(
    client: PoolClient,
    context: TenantAdminRequestContext,
    clientId: string,
    engagementId: string,
    serviceName: string,
    employeeId: string,
    taskCount: number,
  ): Promise<void> {
    await client.query(
      `
        with details as (
          select t.display_name as tenant_name
          from public.tenants t
          where t.id = $1
        ),
        inserted_notification as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
          )
          select
            'CLIENT_SERVICE_ACTIVATED',
            'Service activated',
            details.tenant_name || ' activated ' || $5 || ' with ' || $6::text || ' scheduled tasks.',
            'INFO',
            $1,
            $3,
            'engagement',
            $4::uuid,
            '/client/services',
            jsonb_build_object('serviceName', $5, 'taskCount', $6, 'clientId', $2::uuid),
            'client-service-activated:' || $4::uuid::text
          from details
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        ),
        notification_row as (
          select id from inserted_notification
          union all
          select id from public.notifications where idempotency_key = 'client-service-activated:' || $4::uuid::text
          limit 1
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select notification_row.id, cpa.user_id
        from notification_row
        join public.client_portal_accounts cpa
          on cpa.tenant_id = $1 and cpa.client_id = $2::uuid and cpa.status = 'active'
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, clientId, context.userId, engagementId, serviceName, taskCount],
    );
    await client.query(
      `
        with inserted_notification as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
          )
          values (
            'EMPLOYEE_SERVICE_ASSIGNED',
            'Service assigned',
            $5 || ' was assigned to you with ' || $6::text || ' scheduled tasks.',
            'INFO',
            $1,
            $3,
            'engagement',
            $4::uuid,
            '/employee/tasks',
            jsonb_build_object('serviceName', $5, 'taskCount', $6, 'employeeId', $2::uuid),
            'employee-service-assigned:' || $4::uuid::text
          )
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        ),
        notification_row as (
          select id from inserted_notification
          union all
          select id from public.notifications where idempotency_key = 'employee-service-assigned:' || $4::uuid::text
          limit 1
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select notification_row.id, tm.user_id
        from notification_row
        join public.employees e on e.tenant_id = $1 and e.id = $2::uuid
        join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, employeeId, context.userId, engagementId, serviceName, taskCount],
    );
  }

  private async requireClient(client: PoolClient, tenantId: string, clientId: string): Promise<{ name: string }> {
    const result = await client.query<{ name: string }>(
      "select display_name as name from public.clients where tenant_id = $1 and id = $2 and status in ('active', 'onboarding')",
      [tenantId, clientId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ code: "CLIENT_NOT_AVAILABLE", message: "Select an available client for this tenant." });
    }
    return result.rows[0];
  }

  private async requireService(client: PoolClient, tenantId: string, serviceId: string): Promise<{ id: string; name: string; code: string }> {
    const result = await client.query<{ id: string; name: string; code: string }>(
      "select id::text, name, code from public.services where tenant_id = $1 and id = $2 and status = 'active'",
      [tenantId, serviceId],
    );
    if (!result.rows[0]) {
      throw new BadRequestException({ code: "SERVICE_NOT_AVAILABLE", message: "Select an active service for this tenant." });
    }
    return result.rows[0];
  }

  private async requireAssignableEmployee(
    client: PoolClient,
    tenantId: string,
    employeeId: string,
    serviceId: string,
  ): Promise<void> {
    const employee = await client.query(
      "select 1 from public.employees where tenant_id = $1 and id = $2 and employment_status = 'active'",
      [tenantId, employeeId],
    );
    if (!employee.rowCount) {
      throw new BadRequestException({ code: "EMPLOYEE_NOT_AVAILABLE", message: "Select an active employee for this service." });
    }
    const capableCount = await client.query<{ count: string }>(
      "select count(*)::text from public.employee_service_capabilities where tenant_id = $1 and service_id = $2 and status = 'active'",
      [tenantId, serviceId],
    );
    if (Number(capableCount.rows[0]?.count ?? 0) === 0) return;
    const capable = await client.query(
      `
        select 1
        from public.employee_service_capabilities
        where tenant_id = $1 and employee_id = $2 and service_id = $3 and status = 'active'
      `,
      [tenantId, employeeId, serviceId],
    );
    if (!capable.rowCount) {
      throw new BadRequestException({
        code: "EMPLOYEE_NOT_CAPABLE",
        message: "Select an employee who handles this service.",
      });
    }
  }

  private async requireFinancialYear(
    client: PoolClient,
    tenantId: string,
    countryCode: string,
  ): Promise<{ id: string; startsOn: string; endsOn: string }> {
    const result = await client.query<{ id: string; starts_on: string; ends_on: string }>(
      `
        select id::text, start_date::text as starts_on, end_date::text as ends_on
        from public.tenant_financial_years
        where tenant_id = $1
          and country_code = $2
          and status <> 'cancelled'
          and current_date between start_date and end_date
        order by start_date desc
        limit 1
      `,
      [tenantId, countryCode],
    );
    if (!result.rows[0]) {
      throw new ConflictException({
        code: "COUNTRY_FINANCIAL_YEAR_REQUIRED",
        message: "Configure the current financial year for the selected country before activating services.",
      });
    }
    return { id: result.rows[0].id, startsOn: result.rows[0].starts_on, endsOn: result.rows[0].ends_on };
  }

  private async employeeName(client: PoolClient, tenantId: string, employeeId: string): Promise<string> {
    const result = await client.query<{ name: string }>(
      `
        select coalesce(tm.display_name, u.display_name, e.employee_code) as name
        from public.employees e
        join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
        left join public.users u on u.id = tm.user_id
        where e.tenant_id = $1 and e.id = $2
      `,
      [tenantId, employeeId],
    );
    return result.rows[0]?.name ?? "Assigned employee";
  }

  private async withContext<T>(context: TenantAdminRequestContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function requestFingerprint(clientId: string, input: ActivateClientServicesRequest): string {
  const canonical = {
    clientId,
    countryCode: input.countryCode,
    currencyCode: input.currencyCode,
    ...(input.discountPercent !== undefined
      ? { discountPercent: normalizeDiscountPercent(input.discountPercent) }
      : {}),
    services: [...input.services]
      .map((service) => ({
        serviceId: service.serviceId,
        assignedEmployeeId: service.assignedEmployeeId,
        tasks: [...service.tasks]
          .filter((task) => task.enabled !== false)
          .map((task) => ({
            taskType: task.taskType,
            frequency: task.frequency,
            dueRule: task.dueRule,
            rateAmount: task.rateAmount,
            unitType: task.unitType,
          }))
          .sort((left, right) => left.taskType.localeCompare(right.taskType)),
      }))
      .sort((left, right) => left.serviceId.localeCompare(right.serviceId)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDiscountPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, roundMoney(Number(value))));
}
