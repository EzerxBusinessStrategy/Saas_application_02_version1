import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { suggestFinancialYear } from "./financial-year-policy";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { publishTaskWorkflowNotification, resumeReturnedTaskTimer } from "./task-workflow-support";
import {
  replaceEmployeeSpecialization,
  resolveServiceIdsForSpecialization,
} from "./employee-specialization";
import {
  CreateTenantAdminEmployeeRequest,
  CreateTenantAdminDepartmentRequest,
  CreateTenantAdminTaskRequest,
  TenantAdminTaskApprovalRequest,
  UpdateTenantAdminEmployeeAssignmentRequest,
  UpsertTenantAdminWorkGroupRequest,
} from "./tenant-admin-tasks.dto";

export type TenantAdminTaskOption = {
  readonly id: string;
  readonly name: string;
};

export type TenantAdminEmployeeOption = TenantAdminTaskOption & {
  readonly employeeCode: string | null;
  readonly email: string;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
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

export type TenantAdminDepartmentRow = TenantAdminTaskOption & {
  readonly status: "active" | "inactive" | "archived";
  readonly employeeCount: number;
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
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
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
  readonly latestSubmissionStatus: "submitted" | "returned" | "manager_approved" | "tenant_approved" | "cancelled" | null;
  readonly latestReviewRemarks: string | null;
};

export type TaskReviewDetailRow = {
  readonly task: TenantAdminTaskRow;
  readonly comments: readonly {
    readonly id: string;
    readonly author: string;
    readonly kind: "submission" | "review";
    readonly message: string;
    readonly createdAt: Date;
  }[];
  readonly workLogs: readonly {
    readonly id: string;
    readonly employee: string;
    readonly workedSeconds: number;
    readonly startedAt: Date;
    readonly endedAt: Date | null;
  }[];
  readonly attachments: readonly {
    readonly id: string;
    readonly title: string;
    readonly fileName: string;
    readonly fileType: string;
    readonly sizeBytes: number;
    readonly uploadedBy: string;
    readonly updatedAt: Date;
  }[];
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

type FinancialYearTemplate = {
  readonly id: string;
  readonly countryCode: string;
  readonly policyMode: string;
  readonly startMonth: number;
  readonly startDay: number;
  readonly endMonth: number;
  readonly endDay: number;
};

type TaskFinancialYear = {
  readonly id: string;
  readonly label: string;
  readonly startsOn: string;
  readonly endsOn: string;
};

@Injectable()
export class TenantAdminTasksRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getOptions(context: TenantAdminRequestContext): Promise<TenantAdminTaskOptions> {
    return this.withContext(context, async (client) => ({
      clients: await this.getClients(client, context.tenantId),
      services: await this.getServices(client, context.tenantId),
      employees: await this.getEmployeesForCurrentSchema(client, context.tenantId),
      workGroups: await this.getWorkGroups(client, context.tenantId),
      rateItems: await this.getRateItems(client, context.tenantId),
      countries: await this.getTaskCountries(client, context.tenantId),
    }));
  }

  async listTasks(context: TenantAdminRequestContext, clientId?: string): Promise<readonly TenantAdminTaskRow[]> {
    return this.withContext(context, (client) => this.getTasks(client, context.tenantId, clientId));
  }

  async getReviewDetail(context: TenantAdminRequestContext, taskId: string): Promise<TaskReviewDetailRow> {
    return this.withContext(context, async (client) => {
      const task = (await this.getTasks(client, context.tenantId, undefined, taskId))[0];
      if (!task) throw new ConflictException({ code: "TASK_NOT_FOUND", message: "Task could not be found." });
      return this.getReviewDetailForTask(client, context.tenantId, task);
    });
  }

  async listEmployees(context: TenantAdminRequestContext): Promise<{
    readonly employees: readonly TenantAdminEmployeeOption[];
    readonly departments: readonly TenantAdminTaskOption[];
  }> {
    return this.withContext(context, async (client) => ({
      employees: await this.getEmployeesForCurrentSchema(client, context.tenantId),
      departments: await this.getDepartments(client, context.tenantId),
    }));
  }

  async listDepartments(context: TenantAdminRequestContext): Promise<{
    readonly departments: readonly TenantAdminDepartmentRow[];
    readonly employees: readonly TenantAdminEmployeeOption[];
  }> {
    return this.withContext(context, async (client) => ({
      departments: await this.getDepartmentDirectory(client, context.tenantId),
      employees: await this.getEmployeesForCurrentSchema(client, context.tenantId),
    }));
  }

  async createDepartment(
    context: TenantAdminRequestContext,
    input: CreateTenantAdminDepartmentRequest,
  ): Promise<TenantAdminDepartmentRow> {
    return this.withContext(context, async (client) => {
      await this.lockDepartmentName(client, context.tenantId, input.name);
      const existing = await this.findDepartmentByName(client, context.tenantId, input.name);
      if (existing) {
        throw new ConflictException({
          code: "DEPARTMENT_NAME_EXISTS",
          message: "A department with this name already exists in this tenant.",
        });
      }
      const department = await this.createDepartmentRecord(client, context.tenantId, input.name);
      await client.query(
        "select audit.write_audit_event('DEPARTMENT_CREATED', 'department', $1::uuid, 'succeeded', null, $2::jsonb)",
        [department.id, JSON.stringify({ name: department.name })],
      );
      return this.getDepartmentRowOrThrow(client, context.tenantId, department.id);
    });
  }

  async userEmailExists(context: TenantAdminRequestContext, normalizedEmail: string): Promise<boolean> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{ exists: boolean }>(
        "select private.user_email_exists($1::text) as exists",
        [normalizedEmail],
      );
      return result.rows[0]?.exists ?? false;
    });
  }

  async createEmployee(
    context: TenantAdminRequestContext,
    input: CreateTenantAdminEmployeeRequest,
    passwordHash: string,
  ): Promise<TenantAdminEmployeeOption> {
    return this.withContext(context, async (client) => {
      const email = input.email.trim().toLowerCase();
      const code = input.employeeCode?.trim().toLowerCase() || `emp-${randomUUID().slice(0, 8)}`;
      const department = await this.resolveDepartment(client, context.tenantId, input.departmentId, input.newDepartmentName);
      const userResult = await client.query<{ id: string }>(
        `
          insert into public.users (
            email,
            email_normalized,
            display_name,
            status
          )
          values ($1, $1, $2, 'active')
          returning id::text
        `,
        [email, input.name],
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
            department_id,
            experience_level,
            employment_status,
            default_capacity_minutes_per_week
          )
          values ($1, $2, $3, $4, $5, 'active', $6)
          returning id::text, employee_code
        `,
        [context.tenantId, membershipId, code, department?.id ?? null, input.experienceLevel ?? null, input.weeklyCapacityHours * 60],
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
      await client.query(
        `insert into authn.credentials (portal_type, user_id, tenant_id, employee_id, email, email_normalized, password_hash, status, password_changed_at)
         values ('EMPLOYEE', $1::uuid, $2::uuid, $3::uuid, $4, $4, $5, 'ACTIVE', now())`,
        [userId, context.tenantId, employee.id, email, passwordHash],
      );
      const specializationIds = await resolveServiceIdsForSpecialization(
        client,
        context.tenantId,
        input.serviceIds ?? [],
        input.skills ?? [],
      );
      await replaceEmployeeSpecialization(client, context.tenantId, employee.id, specializationIds);
      if (input.isManager) {
        await this.assignManagerRole(client, context, employee.id);
        await this.notifyEmployeeManagerRoleChanged(
          client,
          context,
          await this.getEmployeeForRoleChange(client, context.tenantId, employee.id),
          true,
        );
      }

      await client.query(
        "select audit.write_audit_event('EMPLOYEE_CREATED', 'employee', $1::uuid, 'succeeded', null, $2::jsonb)",
        [employee.id, JSON.stringify({ employeeCode: employee.employee_code, email, isManager: input.isManager, skills: input.skills, serviceIds: specializationIds, experienceLevel: input.experienceLevel ?? null, departmentId: department?.id ?? null, departmentName: department?.name ?? null })],
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
      if (employee.is_manager === isManager) {
        return this.getEmployeeOptionOrThrow(client, context.tenantId, employee.id);
      }
      if (isManager) await this.assignManagerRole(client, context, employeeId);
      else await this.removeManagerRole(client, context, employee.membership_id, employeeId);
      await this.notifyEmployeeManagerRoleChanged(client, context, employee, isManager);
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

  async updateEmployeeAssignment(
    context: TenantAdminRequestContext,
    employeeId: string,
    input: UpdateTenantAdminEmployeeAssignmentRequest,
  ): Promise<TenantAdminEmployeeOption> {
    return this.withContext(context, async (client) => {
      await this.getEmployeeForRoleChange(client, context.tenantId, employeeId);

      if (input.departmentId !== undefined && input.departmentId !== null) {
        const department = await client.query(
          "select 1 from public.departments where tenant_id = $1 and id = $2 and status = 'active'",
          [context.tenantId, input.departmentId],
        );
        if (!department.rowCount) {
          throw new BadRequestException({ code: "DEPARTMENT_NOT_FOUND", message: "Select an active department in this tenant." });
        }
      }

      if (input.managerId !== undefined && input.managerId !== null) {
        if (input.managerId === employeeId) {
          throw new BadRequestException({ code: "EMPLOYEE_MANAGER_SELF", message: "An employee cannot be their own manager." });
        }
        const manager = await client.query(
          `
            select 1
            from public.employees e
            join public.membership_roles mr
              on mr.tenant_id = e.tenant_id
             and mr.membership_id = e.membership_id
             and mr.status = 'active'
            join public.roles r on r.id = mr.role_id and r.code = 'MANAGER'
            where e.tenant_id = $1
              and e.id = $2
              and e.employment_status = 'active'
          `,
          [context.tenantId, input.managerId],
        );
        if (!manager.rowCount) {
          throw new BadRequestException({ code: "MANAGER_NOT_FOUND", message: "Select an active manager in this tenant." });
        }
      }

      if (input.departmentId !== undefined || input.experienceLevel !== undefined) {
        await client.query(
          `
            update public.employees
            set department_id = case when $3 then $4::uuid else department_id end,
                experience_level = case when $5 then $6::text else experience_level end,
                updated_at = now()
            where tenant_id = $1 and id = $2 and employment_status = 'active'
          `,
          [
            context.tenantId,
            employeeId,
            input.departmentId !== undefined,
            input.departmentId ?? null,
            input.experienceLevel !== undefined,
            input.experienceLevel ?? null,
          ],
        );
      }

      if (input.serviceIds !== undefined || input.skills !== undefined) {
        const specializationIds = await resolveServiceIdsForSpecialization(
          client,
          context.tenantId,
          input.serviceIds ?? [],
          input.skills ?? [],
        );
        await replaceEmployeeSpecialization(client, context.tenantId, employeeId, specializationIds);
      }

      if (input.managerId !== undefined) {
        if (input.managerId === null) {
          await client.query("delete from public.employee_manager_assignments where tenant_id = $1 and employee_id = $2", [context.tenantId, employeeId]);
        } else {
          await client.query(
            `
              insert into public.employee_manager_assignments (tenant_id, employee_id, manager_employee_id, assigned_by)
              values ($1, $2, $3, $4)
              on conflict (tenant_id, employee_id) do update
                set manager_employee_id = excluded.manager_employee_id,
                    assigned_by = excluded.assigned_by,
                    updated_at = now()
            `,
            [context.tenantId, employeeId, input.managerId, context.membershipId],
          );
        }
      }

      if (input.workGroupIds !== undefined) {
        await this.replaceEmployeeWorkGroupMemberships(client, context, employeeId, input.workGroupIds);
      }

      await client.query(
        "select audit.write_audit_event('EMPLOYEE_ASSIGNMENT_UPDATED', 'employee', $1::uuid, 'succeeded', null, $2::jsonb)",
        [employeeId, JSON.stringify(input)],
      );
      return this.getEmployeeOptionOrThrow(client, context.tenantId, employeeId);
    });
  }

  async listWorkGroups(context: TenantAdminRequestContext): Promise<readonly TenantAdminWorkGroupRow[]> {
    return this.withContext(context, (client) => this.getWorkGroupRows(client, context.tenantId));
  }

  async createWorkGroup(
    context: TenantAdminRequestContext,
    input: UpsertTenantAdminWorkGroupRequest,
  ): Promise<TenantAdminWorkGroupRow> {
    return this.withContext(context, async (client) => {
      await this.assertManagerEmployee(client, context.tenantId, input.managerEmployeeId);
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
      await this.assertManagerEmployee(client, context.tenantId, input.managerEmployeeId);
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
        taskId,
        input.clientId,
        pricing,
        input.billing.discountType,
        input.billing.discountValue,
      );

      if (employeeIds.length) {
        await client.query(
          `
            insert into public.task_assignments (
              tenant_id,
              task_id,
              employee_id,
              assigned_by,
              assignment_source
            )
            select $1, $2, employee_id, $4, $5
            from unnest($3::uuid[]) as selected(employee_id)
            on conflict (tenant_id, task_id, employee_id) do nothing
          `,
          [
            context.tenantId,
            taskId,
            employeeIds,
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

  async decideTaskApproval(
    context: TenantAdminRequestContext,
    taskId: string,
    input: TenantAdminTaskApprovalRequest,
  ): Promise<TenantAdminTaskRow> {
    return this.withContext(context, async (client) => {
      const submissionResult = await client.query<{ id: string; employee_id: string }>(
        `
          select ts.id::text, ts.employee_id::text
          from public.tasks t
          join public.task_submissions ts
            on ts.tenant_id = t.tenant_id
           and ts.task_id = t.id
          where t.tenant_id = $1
            and t.id = $2
            and t.status in ('manager_review', 'tenant_approval')
            and ts.status in ('submitted', 'manager_approved')
          order by ts.submitted_at desc
          limit 1
          for update of t, ts
        `,
        [context.tenantId, taskId],
      );
      const submission = submissionResult.rows[0];
      if (!submission) {
        throw new ConflictException({
          code: "TASK_NOT_AWAITING_REVIEW",
          message: "This task is no longer awaiting review.",
        });
      }

      const approved = input.decision === "approve";
      const taskStatus = approved ? "completed" : "in_progress";
      const billingStatus = approved ? "ready_for_billing" : "pending_completion";
      await client.query(
        `
          update public.task_submissions
          set status = $3,
              remarks = coalesce(nullif($4, ''), remarks),
              updated_at = now()
          where tenant_id = $1
            and id = $2
        `,
        [context.tenantId, submission.id, approved ? "tenant_approved" : "returned", input.remarks],
      );
      await client.query(
        `
          update public.task_assignments
          set status = $4,
              updated_at = now()
          where tenant_id = $1
            and task_id = $2
            and employee_id = $3
        `,
        [context.tenantId, taskId, submission.employee_id, approved ? "completed" : "active"],
      );
      await client.query(
        `
          update public.tasks
          set status = $3,
              billable_status = $4,
              actual_completed_at = case when $3 = 'completed' then coalesce(actual_completed_at, clock_timestamp()) else actual_completed_at end,
              updated_by = $5,
              updated_at = now()
          where tenant_id = $1
            and id = $2
        `,
        [context.tenantId, taskId, taskStatus, billingStatus, context.membershipId],
      );
      const billableEntry = await client.query<{ id: string }>(
        `
          update public.billable_task_entries
          set status = $3,
              approved_by = case when $3 = 'approved_for_invoice' then $4::uuid else null end,
              approved_at = case when $3 = 'approved_for_invoice' then clock_timestamp() else null end,
              updated_at = now()
          where tenant_id = $1
            and task_id = $2
            and status = 'pending_review'
          returning id::text
        `,
        [context.tenantId, taskId, approved ? "approved_for_invoice" : "pending_review", context.membershipId],
      );
      if (approved && !billableEntry.rows[0]) {
        throw new ConflictException({
          code: "TASK_BILLING_ENTRY_NOT_AVAILABLE",
          message: "The task charge is not available for invoicing.",
        });
      }
      await client.query(
        `
          insert into public.approvals (
            tenant_id, task_id, submission_id, approval_stage, decision, remarks, decided_by
          )
          values ($1, $2, $3, 'tenant_admin_approval', $4, nullif($5, ''), $6)
        `,
        [context.tenantId, taskId, submission.id, approved ? "approved" : "returned", input.remarks, context.membershipId],
      );
      await client.query(
        "select audit.write_audit_event($1, 'task', $2::uuid, 'succeeded', null, $3::jsonb)",
        [
          approved ? "TENANT_TASK_APPROVED" : "TENANT_TASK_RETURNED",
          taskId,
          JSON.stringify({ remarks: input.remarks || null, employeeId: submission.employee_id }),
        ],
      );
      const task = await this.getTasks(client, context.tenantId, undefined, taskId);
      if (!task[0]) {
        throw new ConflictException({ code: "TASK_LOAD_FAILED", message: "Task could not be loaded after approval." });
      }
      if (approved) {
        await publishTaskWorkflowNotification(client, {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          taskId,
          employeeId: submission.employee_id,
          audience: "employee",
          type: "TASK_COMPLETED",
          title: "Task approved",
          message: `"${task[0].title}" is complete.`,
          actionUrl: `/employee/tasks?task=${taskId}`,
          eventKey: `task-completed:${taskId}`,
        });
        await publishTaskWorkflowNotification(client, {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          taskId,
          employeeId: submission.employee_id,
          audience: "tenant_admins",
          type: "INVOICE_READY_TO_GENERATE",
          title: `Invoice ready: ${task[0].title}`,
          message: `Task "${task[0].title}" is completed. Generate its invoice and send it to the client.`,
          actionUrl: "/admin/invoices",
          eventKey: `invoice-ready:${taskId}`,
        });
        await publishTaskWorkflowNotification(client, {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          taskId,
          employeeId: submission.employee_id,
          audience: "managers",
          type: "TASK_REVIEW_CLOSED_BY_TENANT",
          title: "Task completed by Tenant Admin",
          message: `Tenant Admin completed "${task[0].title}". This task is no longer awaiting your review.`,
          actionUrl: "/employee/task-reviews",
          eventKey: `manager-review-closed-by-tenant:${submission.id}`,
        });
      } else {
        const timerStarted = await resumeReturnedTaskTimer(client, context.tenantId, taskId, submission.employee_id);
        if (timerStarted) {
          await client.query(
            "select audit.write_audit_event('TASK_AUTO_RESUMED_AFTER_TENANT_RETURN', 'task', $1::uuid, 'succeeded', null, $2::jsonb)",
            [taskId, JSON.stringify({ employeeId: submission.employee_id })],
          );
        }
        await publishTaskWorkflowNotification(client, {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          taskId,
          employeeId: submission.employee_id,
          audience: "employee",
          type: "TASK_RETURNED_BY_TENANT",
          title: "Task returned for changes",
          message: `"${task[0].title}" was returned: ${input.remarks}. ${timerStarted ? "Your timer has resumed." : "Resume it when your current task is complete."}`,
          actionUrl: `/employee/tasks?task=${taskId}`,
          eventKey: `task-returned-by-tenant:${submission.id}`,
        });
        await publishTaskWorkflowNotification(client, {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          taskId,
          employeeId: submission.employee_id,
          audience: "managers",
          type: "TASK_REVIEW_CLOSED_BY_TENANT",
          title: "Task returned by Tenant Admin",
          message: `Tenant Admin returned "${task[0].title}" for changes. This task is no longer awaiting your review.`,
          actionUrl: "/employee/task-reviews",
          eventKey: `manager-review-returned-by-tenant:${submission.id}`,
        });
      }
      return task[0];
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

  private async getDepartments(client: PoolClient, tenantId: string): Promise<readonly TenantAdminTaskOption[]> {
    const result = await client.query<{ id: string; name: string }>(
      `
        select id::text, name
        from public.departments
        where tenant_id = $1 and status = 'active'
        order by name asc
      `,
      [tenantId],
    );
    return result.rows;
  }

  private async getDepartmentDirectory(
    client: PoolClient,
    tenantId: string,
  ): Promise<readonly TenantAdminDepartmentRow[]> {
    const result = await client.query<TenantAdminDepartmentRow>(
      `
        select
          d.id::text,
          d.name,
          d.status,
          count(e.id) filter (where e.employment_status = 'active')::int as "employeeCount"
        from public.departments d
        left join public.employees e
          on e.tenant_id = d.tenant_id
         and e.department_id = d.id
        where d.tenant_id = $1
          and d.status <> 'archived'
        group by d.id, d.name, d.status
        order by d.name asc
      `,
      [tenantId],
    );
    return result.rows;
  }

  private async getDepartmentRowOrThrow(
    client: PoolClient,
    tenantId: string,
    departmentId: string,
  ): Promise<TenantAdminDepartmentRow> {
    const result = await client.query<TenantAdminDepartmentRow>(
      `
        select
          d.id::text,
          d.name,
          d.status,
          count(e.id) filter (where e.employment_status = 'active')::int as "employeeCount"
        from public.departments d
        left join public.employees e
          on e.tenant_id = d.tenant_id
         and e.department_id = d.id
        where d.tenant_id = $1
          and d.id = $2
        group by d.id, d.name, d.status
      `,
      [tenantId, departmentId],
    );
    const department = result.rows[0];
    if (!department) {
      throw new ConflictException({
        code: "DEPARTMENT_NOT_FOUND",
        message: "Department could not be found in this tenant.",
      });
    }
    return department;
  }

  private async findDepartmentByName(
    client: PoolClient,
    tenantId: string,
    name: string,
  ): Promise<{ readonly id: string; readonly name: string; readonly status: string } | null> {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    const result = await client.query<{ id: string; name: string; status: string }>(
      `
        select id::text, name, status
        from public.departments
        where tenant_id = $1
          and lower(btrim(name)) = lower($2)
        limit 1
      `,
      [tenantId, normalizedName],
    );
    return result.rows[0] ?? null;
  }

  private async createDepartmentRecord(
    client: PoolClient,
    tenantId: string,
    name: string,
  ): Promise<{ readonly id: string; readonly name: string }> {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    const result = await client.query<{ id: string; name: string }>(
      `
        insert into public.departments (tenant_id, code, name, status)
        values ($1, $2, $3, 'active')
        returning id::text, name
      `,
      [tenantId, `dept-${randomUUID().replaceAll("-", "")}`, normalizedName],
    );
    const department = result.rows[0];
    if (!department) {
      throw new ConflictException({
        code: "DEPARTMENT_CREATE_FAILED",
        message: "Department could not be created.",
      });
    }
    return department;
  }

  private async lockDepartmentName(
    client: PoolClient,
    tenantId: string,
    name: string,
  ): Promise<void> {
    const normalizedName = name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `department:${tenantId}:${normalizedName}`,
    ]);
  }

  private async resolveDepartment(
    client: PoolClient,
    tenantId: string,
    departmentId?: string,
    newDepartmentName?: string,
  ): Promise<{ readonly id: string; readonly name: string } | null> {
    if (departmentId) {
      const department = await client.query<{ id: string; name: string }>(
        `
          select id::text, name
          from public.departments
          where tenant_id = $1
            and id = $2
            and status = 'active'
        `,
        [tenantId, departmentId],
      );
      const selected = department.rows[0];
      if (!selected) {
        throw new BadRequestException({
          code: "DEPARTMENT_NOT_FOUND",
          message: "Select an active department in this tenant.",
        });
      }
      return selected;
    }
    if (!newDepartmentName) return null;

    const normalizedName = newDepartmentName.trim().replace(/\s+/g, " ");
    await this.lockDepartmentName(client, tenantId, normalizedName);
    const existing = await this.findDepartmentByName(client, tenantId, normalizedName);
    if (existing) {
      if (existing.status !== "active") {
        throw new ConflictException({
          code: "DEPARTMENT_NOT_ACTIVE",
          message: "A department with this name exists but is not active.",
        });
      }
      return { id: existing.id, name: existing.name };
    }
    const created = await this.createDepartmentRecord(client, tenantId, normalizedName);
    await client.query(
      "select audit.write_audit_event('DEPARTMENT_CREATED', 'department', $1::uuid, 'succeeded', null, $2::jsonb)",
      [created.id, JSON.stringify({ name: created.name, source: "employee_create" })],
    );
    return created;
  }

  private async getEmployeesForCurrentSchema(
    client: PoolClient,
    tenantId: string,
  ): Promise<readonly TenantAdminEmployeeOption[]> {
    const result = await client.query<{ available: boolean }>(
      "select to_regclass('public.employee_manager_assignments') is not null as available",
    );
    return result.rows[0]?.available
      ? this.getEmployees(client, tenantId)
      : this.getEmployeesWithoutDirectManagerAssignments(client, tenantId);
  }

  private async getEmployeesWithoutDirectManagerAssignments(
    client: PoolClient,
    tenantId: string,
  ): Promise<readonly TenantAdminEmployeeOption[]> {
    const result = await client.query<{
      id: string;
      name: string;
      employee_code: string | null;
      email: string;
      department_id: string | null;
      department_name: string | null;
      is_manager: boolean;
      default_capacity_minutes_per_week: number | null;
      skills: string[] | null;
      categories: string[] | null;
      experience_level: "junior" | "mid" | "senior" | "lead" | null;
      active_tasks: string;
      employment_status: string;
    }>(
      `
        select
          e.id::text,
          coalesce(tm.display_name, e.employee_code) as name,
          e.employee_code,
          u.email,
          e.department_id::text as department_id,
          d.name as department_name,
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
          (
            select count(distinct ta.task_id)::int
            from public.task_assignments ta
            where ta.tenant_id = e.tenant_id
              and ta.employee_id = e.id
              and ta.status = 'active'
          )::text as active_tasks
        from public.employees e
        join public.tenant_memberships tm
          on tm.id = e.membership_id
         and tm.tenant_id = e.tenant_id
        join public.users u on u.id = tm.user_id
        left join public.departments d
          on d.tenant_id = e.tenant_id
         and d.id = e.department_id
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
      departmentId: row.department_id,
      departmentName: row.department_name,
      isManager: row.is_manager,
      skills: row.skills ?? [],
      categories: row.categories ?? [],
      experienceLevel: row.experience_level,
      managerId: null,
      managerName: null,
      activeTasks: Number(row.active_tasks),
      workGroups: [],
      employmentStatus: row.employment_status,
      weeklyCapacityHours: row.default_capacity_minutes_per_week ? Math.max(1, Math.round(row.default_capacity_minutes_per_week / 60)) : 40,
    }));
  }

  private async getEmployees(client: PoolClient, tenantId: string): Promise<readonly TenantAdminEmployeeOption[]> {
    const result = await client.query<{
      id: string;
      name: string;
      employee_code: string | null;
      email: string;
      department_id: string | null;
      department_name: string | null;
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
          e.department_id::text as department_id,
          d.name as department_name,
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
          coalesce(direct_manager.id::text, manager_data.manager_id) as manager_id,
          coalesce(direct_manager_tm.display_name, direct_manager.employee_code, manager_data.manager_name) as manager_name,
          coalesce(task_data.active_tasks, 0)::text as active_tasks,
          coalesce(work_group_data.work_groups, '[]'::jsonb) as work_groups
        from public.employees e
        join public.tenant_memberships tm
          on tm.id = e.membership_id
         and tm.tenant_id = e.tenant_id
        join public.users u
          on u.id = tm.user_id
        left join public.departments d
          on d.tenant_id = e.tenant_id
         and d.id = e.department_id
        left join public.employee_manager_assignments ema
          on ema.tenant_id = e.tenant_id
         and ema.employee_id = e.id
        left join public.employees direct_manager
          on direct_manager.tenant_id = ema.tenant_id
         and direct_manager.id = ema.manager_employee_id
         and direct_manager.employment_status = 'active'
        left join public.tenant_memberships direct_manager_tm
          on direct_manager_tm.tenant_id = direct_manager.tenant_id
         and direct_manager_tm.id = direct_manager.membership_id
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
      departmentId: row.department_id,
      departmentName: row.department_name,
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
    const employee = (await this.getEmployeesForCurrentSchema(client, tenantId)).find((item) => item.id === employeeId);
    if (!employee) throw new ConflictException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee could not be found." });
    return employee;
  }

  private async getEmployeeForRoleChange(client: PoolClient, tenantId: string, employeeId: string) {
    const result = await client.query<{
      id: string;
      name: string;
      employee_code: string | null;
      membership_id: string;
      user_id: string;
      is_manager: boolean;
      default_capacity_minutes_per_week: number | null;
    }>(
      `
        select
          e.id::text,
          coalesce(tm.display_name, e.employee_code) as name,
          e.employee_code,
          e.membership_id::text,
          tm.user_id::text,
          e.default_capacity_minutes_per_week,
          exists (
            select 1
            from public.membership_roles mr
            join public.roles r on r.id = mr.role_id and r.code = 'MANAGER'
            where mr.tenant_id = e.tenant_id
              and mr.membership_id = e.membership_id
              and mr.status = 'active'
          ) as is_manager
        from public.employees e
        join public.tenant_memberships tm on tm.id = e.membership_id and tm.tenant_id = e.tenant_id
        where e.tenant_id = $1 and e.id = $2 and e.employment_status = 'active'
        for update of e
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

  private async removeManagerRole(client: PoolClient, context: TenantAdminRequestContext, membershipId: string, employeeId: string): Promise<void> {
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
    await client.query(
      "delete from public.employee_manager_assignments where tenant_id = $1 and manager_employee_id = $2",
      [context.tenantId, employeeId],
    );
  }

  private async notifyEmployeeManagerRoleChanged(
    client: PoolClient,
    context: TenantAdminRequestContext,
    employee: { readonly id: string; readonly user_id: string },
    isManager: boolean,
  ): Promise<void> {
    await client.query(
      `
        with notification_row as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id,
            entity_type, entity_id, action_url, metadata, idempotency_key
          )
          values (
            $1, $2, $3, 'SUCCESS', $4, $5,
            'employee', $6::uuid, '/employee', jsonb_build_object('isManager', $7::boolean), $8
          )
          returning id
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select id, $9::uuid from notification_row
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [
        isManager ? "EMPLOYEE_PROMOTED_TO_MANAGER" : "EMPLOYEE_MANAGER_ACCESS_REMOVED",
        isManager ? "Manager access enabled" : "Manager access removed",
        isManager
          ? "Your administrator promoted you to Manager. Manager tools are now available in your employee portal."
          : "Your administrator removed your Manager access. Your employee tasks and profile remain available.",
        context.tenantId,
        context.userId,
        employee.id,
        isManager,
        `manager-role:${employee.id}:${isManager ? "enabled" : "disabled"}:${randomUUID()}`,
        employee.user_id,
      ],
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
      members: readonly { id: string; name: string; employeeCode: string | null; email: string }[] | null;
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
                'employeeCode', e.employee_code,
                'email', u.email
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
        left join public.users u
          on u.id = tm.user_id
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
          email: member.email,
          departmentId: null,
          departmentName: null,
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
      effective_from: string;
      effective_to: string | null;
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
          rci.tax_code,
          rc.effective_from::text,
          rc.effective_to::text
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
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
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
    const templates = await client.query<{
      id: string;
      country_code: string;
      policy_mode: string;
      start_month: number;
      start_day: number;
      end_month: number;
      end_day: number;
    }>(
      `
        select id::text, country_code, policy_mode, start_month, start_day, end_month, end_day
        from public.financial_year_templates
        where is_active
          and current_date between effective_from and coalesce(effective_to, 'infinity'::date)
        order by case country_code when 'IN' then 0 else 1 end, country_code
      `,
    );
    const anchorDate = await this.getTenantCalendarAnchor(client, tenantId);

    const countries: TenantAdminTaskCountryOption[] = [];
    for (const row of templates.rows) {
      const template: FinancialYearTemplate = {
        id: row.id,
        countryCode: row.country_code,
        policyMode: row.policy_mode,
        startMonth: row.start_month,
        startDay: row.start_day,
        endMonth: row.end_month,
        endDay: row.end_day,
      };
      const financialYear = await this.ensureCurrentTaskFinancialYear(client, tenantId, template, anchorDate);
      countries.push({
        countryCode: template.countryCode,
        name: countryName(template.countryCode),
        financialYearId: financialYear.id,
        financialYearLabel: financialYear.label,
        startsOn: financialYear.startsOn,
        endsOn: financialYear.endsOn,
      });
    }
    return countries;
  }

  private async getTenantCalendarAnchor(client: PoolClient, tenantId: string): Promise<string> {
    const result = await client.query<{ calendar_anchor: string }>(
      `
        select coalesce(
          (
            select tfy.start_date::text
            from public.tenant_financial_years tfy
            where tfy.tenant_id = t.id
              and tfy.status <> 'cancelled'
            order by (tfy.country_code = t.country) desc, tfy.is_current desc, tfy.start_date desc
            limit 1
          ),
          t.created_at::date::text
        ) as calendar_anchor
        from public.tenants t
        where t.id = $1
      `,
      [tenantId],
    );
    const anchorDate = result.rows[0]?.calendar_anchor;
    if (!anchorDate) throw new ConflictException({ code: "TENANT_NOT_AVAILABLE", message: "Tenant calendar could not be resolved." });
    return anchorDate;
  }

  private async ensureCurrentTaskFinancialYear(
    client: PoolClient,
    tenantId: string,
    template: FinancialYearTemplate,
    calendarAnchorDate: string,
  ): Promise<TaskFinancialYear> {
    const existing = await this.getCurrentFinancialYearForCountry(client, tenantId, template.countryCode);
    if (existing) return existing;

    const suggested = suggestFinancialYear(
      template,
      template.policyMode === "INCORPORATION_DERIVED" ? calendarAnchorDate : undefined,
    );
    if (!suggested) {
      throw new ConflictException({
        code: "COUNTRY_FINANCIAL_YEAR_REQUIRED",
        message: "A confirmed financial year is required for the selected country.",
      });
    }

    await client.query("select pg_advisory_xact_lock(hashtextextended($1::text, 0))", [`${tenantId}:${template.countryCode}`]);
    const afterLock = await this.getCurrentFinancialYearForCountry(client, tenantId, template.countryCode);
    if (afterLock) return afterLock;

    await client.query(
      `
        update public.tenant_financial_years
        set is_current = false,
            updated_at = now()
        where tenant_id = $1
          and country_code = $2
          and is_current
          and current_date not between start_date and end_date
      `,
      [tenantId, template.countryCode],
    );
    const inserted = await client.query<{
      id: string;
      label: string;
      starts_on: string;
      ends_on: string;
    }>(
      `
        insert into public.tenant_financial_years (
          tenant_id, template_id, country_code, label, start_date, end_date,
          status, source, is_current, confirmed_at
        )
        values ($1, $2, $3, $4, $5::date, $6::date, 'active', 'COUNTRY_SUGGESTION_CONFIRMED', true, now())
        on conflict (tenant_id, country_code, start_date, end_date) where status <> 'cancelled'
        do update set
          template_id = excluded.template_id,
          label = excluded.label,
          status = 'active',
          is_current = true,
          updated_at = now()
        returning id::text, label, start_date::text as starts_on, end_date::text as ends_on
      `,
      [tenantId, template.id, template.countryCode, suggested.label, suggested.startsOn, suggested.endsOn],
    );
    const row = inserted.rows[0];
    if (!row) throw new ConflictException({ code: "COUNTRY_FINANCIAL_YEAR_REQUIRED", message: "Country financial year could not be prepared." });
    return { id: row.id, label: row.label, startsOn: row.starts_on, endsOn: row.ends_on };
  }

  private async getCurrentFinancialYearForCountry(
    client: PoolClient,
    tenantId: string,
    countryCode: string,
  ): Promise<TaskFinancialYear | null> {
    const result = await client.query<{ id: string; label: string; starts_on: string; ends_on: string }>(
      `
        select id::text, label, start_date::text as starts_on, end_date::text as ends_on
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
    const row = result.rows[0];
    return row ? { id: row.id, label: row.label, startsOn: row.starts_on, endsOn: row.ends_on } : null;
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
            and coalesce($5::date, current_date) between rc.effective_from and coalesce(rc.effective_to, 'infinity'::date)
            and (rc.client_id = $4 or rc.client_id is null)
          order by rc.client_id nulls first
          limit 1
        `,
        [
          context.tenantId,
          input.billing.rateCardItemId,
          input.serviceId,
          input.clientId,
          input.plannedDueAt?.slice(0, 10) ?? null,
        ],
      );
      if (!result.rows[0]) {
        throw new BadRequestException({
          code: "RATE_NOT_AVAILABLE",
          message: "Select a rate that is active for this task's due date.",
        });
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
          billing_frequency,
          billing_period_key,
          approved_by,
          approved_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, 'pending_review', 'one_time', $2::text, null, null)
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
        with direct_recipient_users as (
          select distinct tm.user_id
          from public.employees e
          join public.tenant_memberships tm
            on tm.id = e.membership_id
           and tm.tenant_id = e.tenant_id
           and tm.status = 'active'
          where e.tenant_id = $1
            and e.id = any($5::uuid[])
            and e.employment_status = 'active'
        ), group_recipient_users as (
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
            and not exists (
              select 1
              from direct_recipient_users direct_user
              where direct_user.user_id = tm.user_id
            )
        ), notification_specs as (
          select
            'direct'::text as audience,
            'TASK_ASSIGNED'::text as type,
            'Task assigned to you'::text as title,
            'A task has been assigned to you: "' || $4 || '".'::text as message,
            'task-assigned:' || $3::uuid::text || ':direct'::text as idempotency_key
          where exists (select 1 from direct_recipient_users)
          union all
          select
            'work_group'::text,
            'TASK_WORKGROUP_ASSIGNED'::text,
            'New task in your work group'::text,
            'A new task was added to your work group: "' || $4 || '".'::text,
            'task-assigned:' || $3::uuid::text || ':work-group:' || $6::uuid::text
          where exists (select 1 from group_recipient_users)
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
            spec.type,
            spec.title,
            spec.message,
            'INFO',
            $1,
            $2,
            'task',
            $3::uuid,
            '/employee/tasks?taskId=' || $3::uuid::text,
            jsonb_build_object(
              'taskName', $4::text,
              'audience', spec.audience,
              'workGroupId', $6::uuid
            ),
            spec.idempotency_key
          from notification_specs spec
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id, idempotency_key
        ),
        notification_rows as (
          select
            spec.audience,
            coalesce(inserted.id, existing.id) as id
          from notification_specs spec
          left join inserted_notification inserted
            on inserted.idempotency_key = spec.idempotency_key
          left join public.notifications existing
            on existing.idempotency_key = spec.idempotency_key
        ), inserted_recipients as (
          insert into public.notification_recipients (notification_id, recipient_user_id)
          select notification_row.id, recipient_user.user_id
          from notification_rows notification_row
          join (
            select 'direct'::text as audience, user_id from direct_recipient_users
            union all
            select 'work_group'::text, user_id from group_recipient_users
          ) recipient_user
            on recipient_user.audience = notification_row.audience
          where notification_row.id is not null
          on conflict (notification_id, recipient_user_id) do nothing
          returning notification_id
        )
        insert into public.notification_outbox (
          tenant_id,
          notification_id,
          event_type,
          event_key
        )
        select
          $1,
          notification_row.id,
          'TASK_NOTIFICATION_READY',
          'task-notification:' || notification_row.id::text
        from notification_rows notification_row
        where notification_row.id is not null
        on conflict (event_key) do nothing
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
    const financialYear = await this.getCurrentFinancialYearForCountry(client, tenantId, countryCode);
    if (!financialYear) {
      throw new ConflictException({
        code: "COUNTRY_FINANCIAL_YEAR_REQUIRED",
        message: "Configure the current financial year for the selected country before creating tasks.",
      });
    }
    return financialYear.id;
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

  private async assertManagerEmployee(
    client: PoolClient,
    tenantId: string,
    managerEmployeeId: string,
  ): Promise<void> {
    const result = await client.query(
      `
        select 1
        from public.employees employee
        join public.tenant_memberships membership
          on membership.id = employee.membership_id
         and membership.tenant_id = employee.tenant_id
         and membership.status = 'active'
        join public.membership_roles membership_role
          on membership_role.tenant_id = membership.tenant_id
         and membership_role.membership_id = membership.id
         and membership_role.status = 'active'
        join public.roles role on role.id = membership_role.role_id
        where employee.tenant_id = $1
          and employee.id = $2
          and employee.employment_status = 'active'
          and role.code = 'MANAGER'
        limit 1
      `,
      [tenantId, managerEmployeeId],
    );
    if (!result.rowCount) {
      throw new BadRequestException({
        code: 'MANAGER_NOT_AVAILABLE',
        message: 'Select an active employee with manager access.',
      });
    }
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
    if (!employeeIds.length) return;
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
        select
          $1,
          $2,
          employee_id,
          case when employee_id = $3::uuid then 'manager' else 'member' end,
          'active',
          $4
        from unnest($5::uuid[]) as selected(employee_id)
        on conflict (tenant_id, work_group_id, employee_id) where status = 'active' do update
        set group_role = excluded.group_role,
            updated_at = now()
      `,
      [context.tenantId, workGroupId, managerEmployeeId, context.membershipId, employeeIds],
    );
  }

  private async replaceEmployeeWorkGroupMemberships(
    client: PoolClient,
    context: TenantAdminRequestContext,
    employeeId: string,
    requestedWorkGroupIds: readonly string[],
  ): Promise<void> {
    const workGroupIds = [...new Set(requestedWorkGroupIds)];
    if (workGroupIds.length) {
      const available = await client.query<{ id: string }>(
        `
          select id::text
          from public.work_groups
          where tenant_id = $1
            and status = 'active'
            and id = any($2::uuid[])
        `,
        [context.tenantId, workGroupIds],
      );
      if (available.rows.length !== workGroupIds.length) {
        throw new BadRequestException({
          code: "WORK_GROUP_NOT_AVAILABLE",
          message: "One or more selected work groups are not active in this tenant.",
        });
      }
    }

    const managed = await client.query<{ work_group_id: string }>(
      `
        select work_group_id::text
        from public.work_group_memberships
        where tenant_id = $1
          and employee_id = $2
          and group_role = 'manager'
          and status = 'active'
      `,
      [context.tenantId, employeeId],
    );
    const managedWorkGroupIds = managed.rows.map((row) => row.work_group_id);
    if (managedWorkGroupIds.some((workGroupId) => !workGroupIds.includes(workGroupId))) {
      throw new BadRequestException({
        code: "WORK_GROUP_MANAGER_REQUIRED",
        message: "A work group manager must remain assigned to that work group. Reassign its manager from the work group first.",
      });
    }

    await client.query(
      `
        update public.work_group_memberships
        set status = 'removed',
            removed_at = now(),
            removed_by = $3,
            updated_at = now()
        where tenant_id = $1
          and employee_id = $2
          and group_role = 'member'
          and status = 'active'
          and not (work_group_id = any($4::uuid[]))
      `,
      [context.tenantId, employeeId, context.membershipId, workGroupIds],
    );

    if (!workGroupIds.length) return;
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
        select $1, selected.work_group_id, $2, 'member', 'active', $3
        from unnest($4::uuid[]) as selected(work_group_id)
        where not exists (
          select 1
          from public.work_group_memberships manager_membership
          where manager_membership.tenant_id = $1
            and manager_membership.work_group_id = selected.work_group_id
            and manager_membership.employee_id = $2
            and manager_membership.group_role = 'manager'
            and manager_membership.status = 'active'
        )
        on conflict (tenant_id, work_group_id, employee_id) where status = 'active' do update
        set group_role = 'member',
            updated_at = now()
      `,
      [context.tenantId, employeeId, context.membershipId, workGroupIds],
    );
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
        latest_submission_status: TenantAdminTaskRow["latestSubmissionStatus"];
        latest_review_remarks: string | null;
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
           latest_submission.status as latest_submission_status,
           latest_approval.remarks as latest_review_remarks,
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
        left join lateral (
          select ts.status
          from public.task_submissions ts
          where ts.tenant_id = t.tenant_id and ts.task_id = t.id
          order by ts.submitted_at desc, ts.id desc
          limit 1
        ) latest_submission on true
        left join lateral (
          select a.remarks
          from public.approvals a
          where a.tenant_id = t.tenant_id and a.task_id = t.id
          order by a.decided_at desc, a.id desc
          limit 1
        ) latest_approval on true
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
           latest_submission.status,
           latest_approval.remarks,
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
       latestSubmissionStatus: row.latest_submission_status,
       latestReviewRemarks: row.latest_review_remarks,
     }));
  }

  private async getReviewDetailForTask(
    client: PoolClient,
    tenantId: string,
    task: TenantAdminTaskRow,
  ): Promise<TaskReviewDetailRow> {
    const [comments, workLogs, attachments] = await Promise.all([
      client.query<{ id: string; author: string; kind: "submission" | "review"; message: string; created_at: Date }>(
        `
          select ts.id::text as id, coalesce(employee_membership.display_name, employee.employee_code) as author,
                 'submission'::text as kind, ts.task_comment as message, ts.submitted_at as created_at
          from public.task_submissions ts
          join public.employees employee on employee.tenant_id = ts.tenant_id and employee.id = ts.employee_id
          join public.tenant_memberships employee_membership on employee_membership.tenant_id = employee.tenant_id and employee_membership.id = employee.membership_id
          where ts.tenant_id = $1 and ts.task_id = $2 and nullif(trim(ts.task_comment), '') is not null
          union all
          select approval.id::text, coalesce(decider.display_name, 'Authorised reviewer'),
                 'review'::text, approval.remarks, approval.decided_at
          from public.approvals approval
          left join public.tenant_memberships decider on decider.tenant_id = approval.tenant_id and decider.id = approval.decided_by
          where approval.tenant_id = $1 and approval.task_id = $2 and nullif(trim(approval.remarks), '') is not null
          order by created_at asc, id asc
        `,
        [tenantId, task.id],
      ),
      client.query<{ id: string; employee: string; worked_seconds: string; started_at: Date; ended_at: Date | null }>(
        `
          select segment.id::text, coalesce(membership.display_name, employee.employee_code) as employee,
                 extract(epoch from (coalesce(segment.ended_at, clock_timestamp()) - segment.started_at))::bigint::text as worked_seconds,
                 segment.started_at, segment.ended_at
          from public.task_work_segments segment
          join public.employees employee on employee.tenant_id = segment.tenant_id and employee.id = segment.employee_id
          join public.tenant_memberships membership on membership.tenant_id = employee.tenant_id and membership.id = employee.membership_id
          where segment.tenant_id = $1 and segment.task_id = $2
          order by segment.started_at asc, segment.id asc
          limit 200
        `,
        [tenantId, task.id],
      ),
      client.query<{ id: string; title: string; file_name: string; file_type: string; size_bytes: number; uploaded_by: string; updated_at: Date }>(
        `
          select document.id::text, document.title, document.file_name, document.file_type, document.size_bytes,
                 coalesce(owner.display_name, 'Authorised user') as uploaded_by, document.updated_at
          from public.tenant_documents document
          left join public.tenant_memberships owner on owner.tenant_id = document.tenant_id and owner.id = document.created_by
          where document.tenant_id = $1 and document.task_id = $2 and document.status = 'active' and document.category <> 'invoice'
          order by document.updated_at desc, document.id desc
          limit 100
        `,
        [tenantId, task.id],
      ),
    ]);
    return {
      task,
      comments: comments.rows.map((row) => ({ id: row.id, author: row.author, kind: row.kind, message: row.message, createdAt: row.created_at })),
      workLogs: workLogs.rows.map((row) => ({ id: row.id, employee: row.employee, workedSeconds: Number(row.worked_seconds), startedAt: row.started_at, endedAt: row.ended_at })),
      attachments: attachments.rows.map((row) => ({ id: row.id, title: row.title, fileName: row.file_name, fileType: row.file_type, sizeBytes: Number(row.size_bytes), uploadedBy: row.uploaded_by, updatedAt: row.updated_at })),
    };
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
    SG: "Singapore",
    US: "United States",
  };
  return names[countryCode] ?? fallback ?? countryCode;
}
