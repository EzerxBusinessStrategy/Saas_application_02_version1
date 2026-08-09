import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import {
  CreateTenantAdminEmployeeRequest,
  CreateTenantAdminTaskRequest,
  UpsertTenantAdminWorkGroupRequest,
} from "./tenant-admin-tasks.dto";

export type TenantAdminTaskOption = {
  readonly id: string;
  readonly name: string;
};

export type TenantAdminEmployeeOption = TenantAdminTaskOption & {
  readonly employeeCode: string | null;
  readonly email: string;
  readonly isManager: boolean;
  readonly skills: readonly string[];
  readonly categories: readonly string[];
  readonly experienceLevel: "junior" | "mid" | "senior" | "lead" | null;
  readonly managerId: string | null;
  readonly managerName: string | null;
  readonly activeTasks: number;
  readonly workGroups: readonly TenantAdminTaskOption[];
  readonly employmentStatus: string;
  readonly weeklyCapacityHours: number;
};

export type TenantAdminWorkGroupOption = TenantAdminTaskOption & {
  readonly clientId: string | null;
};

export type TenantAdminWorkGroupRow = TenantAdminWorkGroupOption & {
  readonly clientName: string | null;
  readonly managerEmployeeId: string;
  readonly managerName: string;
  readonly memberCount: number;
  readonly members: readonly TenantAdminEmployeeOption[];
  readonly status: string;
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

export type TenantAdminTaskCountryOption = {
  readonly countryCode: string;
  readonly name: string;
  readonly financialYearId: string;
  readonly financialYearLabel: string;
  readonly startsOn: string;
  readonly endsOn: string;
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
  readonly countries: readonly TenantAdminTaskCountryOption[];
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
      countries: await this.getTaskCountries(client, context.tenantId),
    }));
  }

  async listTasks(context: TenantAdminRequestContext, clientId?: string): Promise<readonly TenantAdminTaskRow[]> {
    return this.withContext(context, (client) => this.getTasks(client, context.tenantId, clientId));
  }

  async createEmployee(
    context: TenantAdminRequestContext,
    input: CreateTenantAdminEmployeeRequest,
    supabaseAuthUserId: string,
  ): Promise<TenantAdminEmployeeOption> {
    return this.withContext(context, async (client) => {
      const email = input.email.trim().toLowerCase();
      const code = input.employeeCode?.trim().toLowerCase() || `emp-${randomUUID().slice(0, 8)}`;
      const userResult = await client.query<{ id: string }>(
        `
          insert into public.users (
            supabase_auth_user_id,
            email,
            email_normalized,
            display_name,
            status
          )
          values ($3, $1, $1, $2, 'active')
          returning id::text
        `,
        [email, input.name, supabaseAuthUserId],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: "EMPLOYEE_EMAIL_EXISTS",
            message: "This email is already associated with an existing account.",
          });
        }
        throw error;
      });
      const userId = userResult.rows[0]?.id;
      if (!userId) throw new ConflictException({ code: "EMPLOYEE_CREATE_FAILED", message: "Employee user could not be created." });

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
        [context.tenantId, userId, input.name],
      );
      const membershipId = membershipResult.rows[0]?.id;
      if (!membershipId) throw new ConflictException({ code: "EMPLOYEE_CREATE_FAILED", message: "Employee membership could not be created." });

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
          where r.code = 'EMPLOYEE'
          returning id
        `,
        [context.tenantId, membershipId, context.membershipId],
      ).then((result) => {
        if (!result.rowCount) {
          throw new ConflictException({ code: "EMPLOYEE_ROLE_MISSING", message: "Employee role is not configured." });
        }
      });

      const employeeResult = await client.query<{ id: string; employee_code: string }>(
        `
          insert into public.employees (
            tenant_id,
            membership_id,
            employee_code,
            experience_level,
            employment_status,
            default_capacity_minutes_per_week
          )
          values ($1, $2, $3, $4, 'active', $5)
          returning id::text, employee_code
        `,
        [context.tenantId, membershipId, code, input.experienceLevel ?? null, input.weeklyCapacityHours * 60],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: "EMPLOYEE_CODE_EXISTS",
            message: "This employee code already exists.",
          });
        }
        throw error;
      });
      const employee = employeeResult.rows[0];
      if (!employee) throw new ConflictException({ code: "EMPLOYEE_CREATE_FAILED", message: "Employee could not be created." });
      if (input.skills.length) {
        await this.upsertEmployeeSkills(client, context.tenantId, employee.id, input.skills);
      }
      if (input.isManager) await this.assignManagerRole(client, context, employee.id);

      await client.query(
        "select audit.write_audit_event('EMPLOYEE_CREATED', 'employee', $1::uuid, 'succeeded', null, $2::jsonb)",
        [employee.id, JSON.stringify({ employeeCode: employee.employee_code, email, isManager: input.isManager, skills: input.skills, experienceLevel: input.experienceLevel ?? null })],
      );
      return this.getEmployeeOptionOrThrow(client, context.tenantId, employee.id);
    });
  }

  async setEmployeeManagerRole(
    context: TenantAdminRequestContext,
    employeeId: string,
    isManager: boolean,
  ): Promise<TenantAdminEmployeeOption> {
    return this.withContext(context, async (client) => {
      const employee = await this.getEmployeeForRoleChange(client, context.tenantId, employeeId);
      if (isManager) await this.assignManagerRole(client, context, employeeId);
      else await this.removeManagerRole(client, context, employee.membership_id);
      await client.query(
        "select audit.write_audit_event($1, 'employee', $2::uuid, 'succeeded', null, $3::jsonb)",
        [isManager ? "EMPLOYEE_PROMOTED_TO_MANAGER" : "MANAGER_ROLE_REMOVED", employeeId, JSON.stringify({ employeeCode: employee.employee_code })],
      );
      return this.getEmployeeOptionOrThrow(client, context.tenantId, employee.id);
    });
  }

  async updateEmployeeCapacity(
    context: TenantAdminRequestContext,
    employeeId: string,
    weeklyCapacityHours: number,
  ): Promise<TenantAdminEmployeeOption> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{ id: string; name: string; employee_code: string | null; membership_id: string; default_capacity_minutes_per_week: number | null }>(
        `
          update public.employees e
          set default_capacity_minutes_per_week = $3,
              updated_at = now()
          from public.tenant_memberships tm
          where e.membership_id = tm.id
            and tm.tenant_id = e.tenant_id
            and e.tenant_id = $1
            and e.id = $2
          returning e.id::text, coalesce(tm.display_name, e.employee_code) as name, e.employee_code, e.membership_id::text, e.default_capacity_minutes_per_week
        `,
        [context.tenantId, employeeId, weeklyCapacityHours * 60],
      );
      const employee = result.rows[0];
      if (!employee) throw new ConflictException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee could not be found." });
      await client.query(
        "select audit.write_audit_event('EMPLOYEE_CAPACITY_UPDATED', 'employee', $1::uuid, 'succeeded', null, $2::jsonb)",
        [employeeId, JSON.stringify({ weeklyCapacityHours })],
      );
      return this.getEmployeeOptionOrThrow(client, context.tenantId, employee.id);
    });
  }

  async listEmployees(context: TenantAdminRequestContext): Promise<readonly TenantAdminEmployeeOption[]> {
    return this.withContext(context, (client) => this.getEmployees(client, context.tenantId));
  }

  async listWorkGroups(context: TenantAdminRequestContext): Promise<readonly TenantAdminWorkGroupRow[]> {
    return this.withContext(context, (client) => this.getWorkGroupRows(client, context.tenantId));
  }

  async createWorkGroup(
    context: TenantAdminRequestContext,
    input: UpsertTenantAdminWorkGroupRequest,
  ): Promise<TenantAdminWorkGroupRow> {
    return this.withContext(context, async (client) => {
      const memberIds = await this.resolveEmployeeIds(
        client,
        context.tenantId,
        [...new Set([input.managerEmployeeId, ...input.employeeIds])],
      );
      await this.assertClientOptional(client, context.tenantId, input.clientId);
      const result = await client.query<{ id: string }>(
        `
          insert into public.work_groups (
            tenant_id,
            client_id,
            name,
            status,
            created_by
          )
          values ($1, $2, $3, $4, $5)
          returning id::text
        `,
        [context.tenantId, input.clientId ?? null, input.name, input.status, context.membershipId],
      );
      const workGroupId = result.rows[0]?.id;
      if (!workGroupId) throw new ConflictException({ code: "WORK_GROUP_CREATE_FAILED", message: "Work group could not be created." });
      await this.replaceWorkGroupMembers(client, context, workGroupId, input.managerEmployeeId, memberIds);
      await client.query(
        "select audit.write_audit_event('WORK_GROUP_CREATED', 'work_group', $1::uuid, 'succeeded', null, $2::jsonb)",
        [workGroupId, JSON.stringify({ name: input.name, memberCount: memberIds.length })],
      );
      return this.getWorkGroupRowOrThrow(client, context.tenantId, workGroupId);
    });
  }

  async updateWorkGroup(
    context: TenantAdminRequestContext,
    workGroupId: string,
    input: UpsertTenantAdminWorkGroupRequest,
  ): Promise<TenantAdminWorkGroupRow> {
    return this.withContext(context, async (client) => {
      const memberIds = await this.resolveEmployeeIds(
        client,
        context.tenantId,
        [...new Set([input.managerEmployeeId, ...input.employeeIds])],
      );
      await this.assertClientOptional(client, context.tenantId, input.clientId);
      const result = await client.query(
        `
          update public.work_groups
          set name = $3,
              client_id = $4,
              status = $5,
              updated_at = now()
          where tenant_id = $1
            and id = $2
          returning id
        `,
        [context.tenantId, workGroupId, input.name, input.clientId ?? null, input.status],
      );
      if (!result.rowCount) throw new BadRequestException({ code: "WORK_GROUP_NOT_AVAILABLE", message: "Work group was not found." });
      await this.replaceWorkGroupMembers(client, context, workGroupId, input.managerEmployeeId, memberIds);
      await client.query(
        "select audit.write_audit_event('WORK_GROUP_UPDATED', 'work_group', $1::uuid, 'succeeded', null, $2::jsonb)",
        [workGroupId, JSON.stringify({ name: input.name, memberCount: memberIds.length })],
      );
      return this.getWorkGroupRowOrThrow(client, context.tenantId, workGroupId);
    });
  }

  async createTask(context: TenantAdminRequestContext, input: CreateTenantAdminTaskRequest): Promise<TenantAdminTaskRow> {
    return this.withContext(context, async (client) => {
      const tenant = await this.getTenantProfile(client, context.tenantId);
      const financialYearId = await this.getFinancialYearIdForCountry(client, context.tenantId, input.countryCode);

      await this.assertClientExists(client, context.tenantId, input.clientId);
      await this.assertServiceExists(client, context.tenantId, input.serviceId);
      if (input.workGroupId) {
        await this.assertWorkGroupExists(client, context.tenantId, input.workGroupId, input.clientId);
      }
      const pricing = await this.resolveBillingRate(client, context, input, tenant?.currencyCode ?? "INR");

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
          input.countryCode,
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

      await this.createPendingBillableEntry(
        client,
        context.tenantId,
        context.membershipId,
        taskId,
        input.clientId,
        pricing,
        input.billing.discountType,
        input.billing.discountValue,
      );

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
      await this.notifyClientTaskCreated(client, context, taskId, input.clientId, input.title);
      await this.notifyTaskParticipantsCreated(client, context, taskId, input.title, employeeIds, input.workGroupId);

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
          and status in ('active', 'onboarding')
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
    const result = await client.query<{
      id: string;
      name: string;
      employee_code: string | null;
      email: string;
      is_manager: boolean;
      default_capacity_minutes_per_week: number | null;
      skills: string[] | null;
      categories: string[] | null;
      experience_level: "junior" | "mid" | "senior" | "lead" | null;
      manager_id: string | null;
      manager_name: string | null;
      active_tasks: string;
      work_groups: readonly { id: string; name: string }[] | null;
      employment_status: string;
    }>(
      `
        select
          e.id::text,
          coalesce(tm.display_name, e.employee_code) as name,
          e.employee_code,
          u.email,
          e.default_capacity_minutes_per_week,
          e.experience_level,
          e.employment_status,
          exists (
            select 1
            from public.membership_roles mr
            join public.roles r on r.id = mr.role_id and r.code = 'MANAGER'
            where mr.tenant_id = e.tenant_id
              and mr.membership_id = e.membership_id
              and mr.status = 'active'
          ) as is_manager,
          coalesce(skill_data.skills, '{}'::text[]) as skills,
          coalesce(skill_data.categories, '{}'::text[]) as categories,
          manager_data.manager_id,
          manager_data.manager_name,
          coalesce(task_data.active_tasks, 0)::text as active_tasks,
          coalesce(work_group_data.work_groups, '[]'::jsonb) as work_groups
        from public.employees e
        join public.tenant_memberships tm
          on tm.id = e.membership_id
         and tm.tenant_id = e.tenant_id
        join public.users u
          on u.id = tm.user_id
        left join lateral (
          select
            array_agg(distinct s.name order by s.name) as skills,
            array_agg(distinct s.category order by s.category)
              filter (where s.category is not null and s.category <> '') as categories
          from public.employee_skills es
          join public.skills s
            on s.id = es.skill_id
           and s.tenant_id = es.tenant_id
           and s.status = 'active'
          where es.tenant_id = e.tenant_id
            and es.employee_id = e.id
        ) skill_data on true
        left join lateral (
          select
            me.id::text as manager_id,
            coalesce(mtm.display_name, me.employee_code) as manager_name
          from public.work_group_memberships self_wgm
          join public.work_group_memberships manager_wgm
            on manager_wgm.work_group_id = self_wgm.work_group_id
           and manager_wgm.tenant_id = self_wgm.tenant_id
           and manager_wgm.status = 'active'
           and manager_wgm.group_role = 'manager'
          join public.employees me
            on me.id = manager_wgm.employee_id
           and me.tenant_id = manager_wgm.tenant_id
          join public.tenant_memberships mtm
            on mtm.id = me.membership_id
           and mtm.tenant_id = me.tenant_id
          where self_wgm.tenant_id = e.tenant_id
            and self_wgm.employee_id = e.id
            and self_wgm.status = 'active'
            and me.id <> e.id
          order by self_wgm.joined_at asc
          limit 1
        ) manager_data on true
        left join lateral (
          select count(distinct ta.task_id)::int as active_tasks
          from public.task_assignments ta
          where ta.tenant_id = e.tenant_id
            and ta.employee_id = e.id
            and ta.status = 'active'
        ) task_data on true
        left join lateral (
          select
            jsonb_agg(
              distinct jsonb_build_object('id', wg.id::text, 'name', wg.name)
            ) filter (where wg.id is not null) as work_groups
          from public.work_group_memberships wgm
          join public.work_groups wg
            on wg.id = wgm.work_group_id
           and wg.tenant_id = wgm.tenant_id
           and wg.status = 'active'
          where wgm.tenant_id = e.tenant_id
            and wgm.employee_id = e.id
            and wgm.status = 'active'
        ) work_group_data on true
        where e.tenant_id = $1
          and e.employment_status = 'active'
        order by coalesce(tm.display_name, e.employee_code) asc
      `,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      employeeCode: row.employee_code,
      email: row.email,
      isManager: row.is_manager,
      skills: row.skills ?? [],
      categories: row.categories ?? [],
      experienceLevel: row.experience_level,
      managerId: row.manager_id,
      managerName: row.manager_name,
      activeTasks: Number(row.active_tasks),
      workGroups: row.work_groups ?? [],
      employmentStatus: row.employment_status,
      weeklyCapacityHours: row.default_capacity_minutes_per_week ? Math.max(1, Math.round(row.default_capacity_minutes_per_week / 60)) : 40,
    }));
  }

  private async getEmployeeOptionOrThrow(
    client: PoolClient,
    tenantId: string,
    employeeId: string,
  ): Promise<TenantAdminEmployeeOption> {
    const employee = (await this.getEmployees(client, tenantId)).find((item) => item.id === employeeId);
    if (!employee) throw new ConflictException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee could not be found." });
    return employee;
  }

  private async getEmployeeForRoleChange(client: PoolClient, tenantId: string, employeeId: string) {
    const result = await client.query<{ id: string; name: string; employee_code: string | null; membership_id: string; default_capacity_minutes_per_week: number | null }>(
      `
        select e.id::text, coalesce(tm.display_name, e.employee_code) as name, e.employee_code, e.membership_id::text, e.default_capacity_minutes_per_week
        from public.employees e
        join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
        where e.tenant_id = $1 and e.id = $2 and e.employment_status = 'active'
      `,
      [tenantId, employeeId],
    );
    const employee = result.rows[0];
    if (!employee) throw new ConflictException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee could not be found." });
    return employee;
  }

  private async assignManagerRole(client: PoolClient, context: TenantAdminRequestContext, employeeId: string): Promise<void> {
    const employee = await this.getEmployeeForRoleChange(client, context.tenantId, employeeId);
    const result = await client.query(
      `
        insert into public.membership_roles (tenant_id, membership_id, role_id, assigned_by_membership_id, status)
        select $1, $2, r.id, $3, 'active'
        from public.roles r
        where r.code = 'MANAGER'
        on conflict (tenant_id, membership_id, role_id) do update
          set status = 'active',
              assigned_by_membership_id = excluded.assigned_by_membership_id,
              assigned_at = now()
      `,
      [context.tenantId, employee.membership_id, context.membershipId],
    );
    if (!result.rowCount) throw new ConflictException({ code: "MANAGER_ROLE_MISSING", message: "Manager role is not configured." });
  }

  private async removeManagerRole(client: PoolClient, context: TenantAdminRequestContext, membershipId: string): Promise<void> {
    await client.query(
      `
        update public.membership_roles mr
        set status = 'revoked',
            revoked_by_membership_id = $3,
            revoked_at = now()
        from public.roles r
        where r.id = mr.role_id
          and r.code = 'MANAGER'
          and mr.tenant_id = $1
          and mr.membership_id = $2
          and mr.status = 'active'
      `,
      [context.tenantId, membershipId, context.membershipId],
    );
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

  private async getWorkGroupRows(
    client: PoolClient,
    tenantId: string,
    workGroupId?: string,
  ): Promise<readonly TenantAdminWorkGroupRow[]> {
    const result = await client.query<{
      id: string;
      name: string;
      client_id: string | null;
      client_name: string | null;
      manager_employee_id: string | null;
      manager_name: string | null;
      member_count: string;
      members: readonly { id: string; name: string; employeeCode: string | null }[] | null;
      status: string;
    }>(
      `
        select
          wg.id::text,
          wg.name,
          wg.client_id::text,
          c.display_name as client_name,
          manager.employee_id::text as manager_employee_id,
          manager.display_name as manager_name,
          count(distinct wgm.employee_id)::text as member_count,
          coalesce(
            jsonb_agg(
              distinct jsonb_build_object(
                'id', e.id::text,
                'name', coalesce(tm.display_name, e.employee_code),
                'employeeCode', e.employee_code
              )
            ) filter (where e.id is not null),
            '[]'::jsonb
          ) as members,
          wg.status
        from public.work_groups wg
        left join public.clients c
          on c.id = wg.client_id
         and c.tenant_id = wg.tenant_id
        left join public.work_group_memberships wgm
          on wgm.work_group_id = wg.id
         and wgm.tenant_id = wg.tenant_id
         and wgm.status = 'active'
        left join public.employees e
          on e.id = wgm.employee_id
         and e.tenant_id = wgm.tenant_id
        left join public.tenant_memberships tm
          on tm.id = e.membership_id
         and tm.tenant_id = e.tenant_id
        left join lateral (
          select
            mwgm.employee_id,
            coalesce(mtm.display_name, me.employee_code) as display_name
          from public.work_group_memberships mwgm
          join public.employees me
            on me.id = mwgm.employee_id
           and me.tenant_id = mwgm.tenant_id
          join public.tenant_memberships mtm
            on mtm.id = me.membership_id
           and mtm.tenant_id = me.tenant_id
          where mwgm.tenant_id = wg.tenant_id
            and mwgm.work_group_id = wg.id
            and mwgm.status = 'active'
            and mwgm.group_role = 'manager'
          order by mwgm.joined_at asc
          limit 1
        ) manager on true
        where wg.tenant_id = $1
          and ($2::uuid is null or wg.id = $2)
        group by wg.id, wg.name, wg.client_id, c.display_name, manager.employee_id, manager.display_name, wg.status
        order by wg.name asc
      `,
      [tenantId, workGroupId ?? null],
    );
    return result.rows
      .filter((row) => row.manager_employee_id && row.manager_name)
      .map((row) => ({
        id: row.id,
        name: row.name,
        clientId: row.client_id,
        clientName: row.client_name,
        managerEmployeeId: row.manager_employee_id ?? "",
        managerName: row.manager_name ?? "",
        memberCount: Number(row.member_count),
        members: (row.members ?? []).map((member) => ({
          id: member.id,
          name: member.name,
          employeeCode: member.employeeCode,
          isManager: member.id === row.manager_employee_id,
          skills: [],
          categories: [],
          experienceLevel: null,
          managerId: row.manager_employee_id,
          managerName: row.manager_name,
          activeTasks: 0,
          workGroups: [{ id: row.id, name: row.name }],
          employmentStatus: "active",
          weeklyCapacityHours: 40,
        })),
        status: row.status,
      }));
  }

  private async getWorkGroupRowOrThrow(
    client: PoolClient,
    tenantId: string,
    workGroupId: string,
  ): Promise<TenantAdminWorkGroupRow> {
    const row = (await this.getWorkGroupRows(client, tenantId, workGroupId))[0];
    if (!row) throw new ConflictException({ code: "WORK_GROUP_LOAD_FAILED", message: "Work group could not be loaded." });
    return row;
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
        order by rc.client_id nulls first, rci.task_type asc, rci.rate_amount asc
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

  private async getTaskCountries(client: PoolClient, tenantId: string): Promise<readonly TenantAdminTaskCountryOption[]> {
    const result = await client.query<{
      country_code: string;
      country_name: string | null;
      financial_year_id: string;
      financial_year_label: string;
      starts_on: string;
      ends_on: string;
    }>(
      `
        select distinct on (coalesce(fyt.country_code, t.country))
          coalesce(fyt.country_code, t.country) as country_code,
          coalesce(fyt.name, fyt.country_code, t.country) as country_name,
          tfy.id::text as financial_year_id,
          tfy.label as financial_year_label,
          tfy.start_date::text as starts_on,
          tfy.end_date::text as ends_on
        from public.tenant_financial_years tfy
        join public.tenants t
          on t.id = tfy.tenant_id
        left join public.financial_year_templates fyt
          on fyt.id = tfy.template_id
        where tfy.tenant_id = $1
          and tfy.status <> 'cancelled'
          and current_date between tfy.start_date and tfy.end_date
          and coalesce(fyt.country_code, t.country) is not null
        order by coalesce(fyt.country_code, t.country), tfy.start_date desc
      `,
      [tenantId],
    );
    return result.rows.map((row) => ({
      countryCode: row.country_code,
      name: countryName(row.country_code, row.country_name),
      financialYearId: row.financial_year_id,
      financialYearLabel: row.financial_year_label,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    }));
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
          order by rc.client_id nulls first
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
    membershipId: string,
    taskId: string,
    clientId: string,
    pricing: TaskPricing,
    discountType?: "percentage" | "fixed",
    discountValue: number = 0,
  ): Promise<void> {
    const grossAmount = roundMoney(pricing.quantity * pricing.unitRate);
    const discountAmount = calculateTaskDiscount(grossAmount, discountType, discountValue);
    const netAmount = roundMoney(grossAmount - discountAmount);
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
          status,
          approved_by,
          approved_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, 'approved_for_invoice', $13, now())
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
        discountType === "fixed" ? "fixed_amount" : discountType ?? null,
        discountValue || null,
        discountAmount,
        netAmount,
        membershipId,
      ],
    );
  }

  private async notifyClientTaskCreated(
    client: PoolClient,
    context: TenantAdminRequestContext,
    taskId: string,
    clientId: string,
    taskTitle: string,
  ): Promise<void> {
    const tableExists = await client.query<{ exists: boolean }>(
      "select to_regclass('public.client_portal_accounts') is not null as exists",
    );
    if (!tableExists.rows[0]?.exists) return;

    await client.query(
      `
        with details as (
          select
            t.display_name as tenant_name,
            coalesce(tm.display_name, u.display_name, 'Tenant Admin') as admin_name
          from public.tenants t
          left join public.tenant_memberships tm
            on tm.id = $2
           and tm.tenant_id = t.id
          left join public.users u
            on u.id = $3
          where t.id = $1
        ),
        inserted_notification as (
          insert into public.notifications (
            type,
            title,
            message,
            severity,
            tenant_id,
            actor_user_id,
            entity_type,
            entity_id,
            action_url,
            metadata,
            idempotency_key
          )
          select
            'CLIENT_TASK_CREATED',
            'New task created',
            details.tenant_name || ' assigned a new task "' || $5 || '" via ' || details.admin_name || '.',
            'INFO',
            $1,
            $3,
            'task',
            $4::uuid,
            '/client/tasks',
            jsonb_build_object(
              'tenantName', details.tenant_name,
              'tenantAdminName', details.admin_name,
              'taskName', $5,
              'clientId', $6::uuid
            ),
            'client-task-created:' || $4::uuid::text
          from details
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        ),
        notification_row as (
          select id from inserted_notification
          union all
          select id
          from public.notifications
          where idempotency_key = 'client-task-created:' || $4::uuid::text
          limit 1
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select notification_row.id, cpa.user_id
        from notification_row
        join public.client_portal_accounts cpa
          on cpa.tenant_id = $1
         and cpa.client_id = $6::uuid
         and cpa.status = 'active'
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, context.membershipId, context.userId, taskId, taskTitle, clientId],
    );
  }

  private async notifyTaskParticipantsCreated(
    client: PoolClient,
    context: TenantAdminRequestContext,
    taskId: string,
    taskTitle: string,
    employeeIds: readonly string[],
    workGroupId?: string,
  ): Promise<void> {
    await client.query(
      `
        with recipient_users as (
          select distinct tm.user_id
          from public.employees e
          join public.tenant_memberships tm
            on tm.id = e.membership_id
           and tm.tenant_id = e.tenant_id
           and tm.status = 'active'
          where e.tenant_id = $1
            and e.id = any($5::uuid[])
            and e.employment_status = 'active'
          union
          select distinct tm.user_id
          from public.work_group_memberships wgm
          join public.employees e
            on e.id = wgm.employee_id
           and e.tenant_id = wgm.tenant_id
           and e.employment_status = 'active'
          join public.tenant_memberships tm
            on tm.id = e.membership_id
           and tm.tenant_id = e.tenant_id
           and tm.status = 'active'
          where wgm.tenant_id = $1
            and wgm.work_group_id = $6::uuid
            and wgm.status = 'active'
            and wgm.group_role = 'manager'
        ),
        inserted_notification as (
          insert into public.notifications (
            type,
            title,
            message,
            severity,
            tenant_id,
            actor_user_id,
            entity_type,
            entity_id,
            action_url,
            metadata,
            idempotency_key
          )
          select
            'TASK_ASSIGNED',
            'Task assigned',
            'A task has been created and assigned: "' || $4 || '".',
            'INFO',
            $1,
            $2,
            'task',
            $3::uuid,
            '/employee/tasks',
            jsonb_build_object(
              'taskName', $4::text,
              'employeeCount', cardinality($5::uuid[]),
              'workGroupId', $6::uuid
            ),
            'task-assigned:' || $3::uuid::text
          where exists (select 1 from recipient_users)
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        ),
        notification_row as (
          select id from inserted_notification
          union all
          select id
          from public.notifications
          where idempotency_key = 'task-assigned:' || $3::uuid::text
          limit 1
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select notification_row.id, recipient_users.user_id
        from notification_row
        cross join recipient_users
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, context.userId, taskId, taskTitle, employeeIds, workGroupId ?? null],
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

  private async getFinancialYearIdForCountry(client: PoolClient, tenantId: string, countryCode: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      `
        select tfy.id::text
        from public.tenant_financial_years tfy
        left join public.financial_year_templates fyt
          on fyt.id = tfy.template_id
        join public.tenants t
          on t.id = tfy.tenant_id
        where tfy.tenant_id = $1
          and coalesce(fyt.country_code, t.country) = $2
          and tfy.status <> 'cancelled'
          and current_date between tfy.start_date and tfy.end_date
        order by tfy.start_date desc
        limit 1
      `,
      [tenantId, countryCode],
    );
    const financialYearId = result.rows[0]?.id;
    if (!financialYearId) {
      throw new ConflictException({
        code: "COUNTRY_FINANCIAL_YEAR_REQUIRED",
        message: "Configure the current financial year for the selected country before creating tasks.",
      });
    }
    return financialYearId;
  }

  private async assertClientExists(client: PoolClient, tenantId: string, clientId: string): Promise<void> {
    const result = await client.query("select 1 from public.clients where tenant_id = $1 and id = $2 and status in ('active', 'onboarding')", [
      tenantId,
      clientId,
    ]);
    if (!result.rowCount) {
      throw new BadRequestException({ code: "CLIENT_NOT_AVAILABLE", message: "Select an available client for this tenant." });
    }
  }

  private async upsertEmployeeSkills(
    client: PoolClient,
    tenantId: string,
    employeeId: string,
    skills: readonly string[],
  ): Promise<void> {
    for (const rawSkill of [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))]) {
      const code = rawSkill.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      if (!code) continue;
      const skillResult = await client.query<{ id: string }>(
        `
          insert into public.skills (tenant_id, code, name, status)
          values ($1, $2, $3, 'active')
          on conflict (tenant_id, code) do update
            set name = excluded.name,
                status = 'active',
                updated_at = now()
          returning id::text
        `,
        [tenantId, code, rawSkill],
      );
      const skillId = skillResult.rows[0]?.id;
      if (!skillId) continue;
      await client.query(
        `
          insert into public.employee_skills (
            tenant_id,
            employee_id,
            skill_id,
            proficiency_level,
            is_verified
          )
          values ($1, $2, $3, 'intermediate', false)
          on conflict (employee_id, skill_id) do update
            set updated_at = now()
        `,
        [tenantId, employeeId, skillId],
      );
    }
  }

  private async assertClientOptional(client: PoolClient, tenantId: string, clientId?: string): Promise<void> {
    if (!clientId) return;
    await this.assertClientExists(client, tenantId, clientId);
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

  private async replaceWorkGroupMembers(
    client: PoolClient,
    context: TenantAdminRequestContext,
    workGroupId: string,
    managerEmployeeId: string,
    employeeIds: readonly string[],
  ): Promise<void> {
    await client.query(
      `
        update public.work_group_memberships
        set status = 'removed',
            removed_at = now(),
            removed_by = $3,
            updated_at = now()
        where tenant_id = $1
          and work_group_id = $2
          and status = 'active'
      `,
      [context.tenantId, workGroupId, context.membershipId],
    );
    for (const employeeId of employeeIds) {
      await client.query(
        `
          insert into public.work_group_memberships (
            tenant_id,
            work_group_id,
            employee_id,
            group_role,
            status,
            added_by
          )
          values ($1, $2, $3, $4, 'active', $5)
          on conflict (tenant_id, work_group_id, employee_id) where status = 'active' do update
          set group_role = excluded.group_role,
              updated_at = now()
        `,
        [
          context.tenantId,
          workGroupId,
          employeeId,
          employeeId === managerEmployeeId ? "manager" : "member",
          context.membershipId,
        ],
      );
    }
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

function calculateTaskDiscount(grossAmount: number, type: "percentage" | "fixed" | undefined, value: number): number {
  if (!type || value <= 0) return 0;
  const amount = type === "percentage" ? grossAmount * (value / 100) : value;
  return Math.min(grossAmount, roundMoney(amount));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function countryName(countryCode: string, fallback?: string | null): string {
  const names: Record<string, string> = {
    GB: "United Kingdom",
    IN: "India",
    US: "United States",
  };
  return names[countryCode] ?? fallback ?? countryCode;
}
