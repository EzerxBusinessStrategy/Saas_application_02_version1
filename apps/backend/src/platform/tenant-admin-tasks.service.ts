import { ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { RequestContext } from "../auth/request-context";
import { APP_CONFIG } from "../config/app-config.module";
import { AppConfig } from "../config/app-config";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  CreateTenantAdminTaskRequest,
  CreateTenantAdminEmployeeRequest,
  TenantAdminEmployeeOptionDto,
  TenantAdminTaskItemDto,
  TenantAdminTaskOptionsResponseDto,
  TenantAdminTasksResponseDto,
  TenantAdminEmployeesResponseDto,
  TenantAdminWorkGroupDto,
  TenantAdminWorkGroupsResponseDto,
  UpdateTenantAdminEmployeeCapacityRequest,
  UpsertTenantAdminWorkGroupRequest,
} from "./tenant-admin-tasks.dto";
import { TenantAdminTaskRow, TenantAdminTasksRepository } from "./tenant-admin-tasks.repository";

@Injectable()
export class TenantAdminTasksService {
  constructor(
    @Inject(TenantAdminTasksRepository)
    private readonly repository: TenantAdminTasksRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getOptions(context: RequestContext): Promise<TenantAdminTaskOptionsResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    return this.repository.getOptions(tenantContext);
  }

  async listTasks(context: RequestContext, clientId?: string): Promise<TenantAdminTasksResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    return {
      tasks: (await this.repository.listTasks(tenantContext, clientId)).map(mapTask),
    };
  }

  async createTask(
    context: RequestContext,
    input: CreateTenantAdminTaskRequest,
  ): Promise<TenantAdminTaskItemDto> {
    const tenantContext = requireTenantAdminContext(context);
    return mapTask(await this.repository.createTask(tenantContext, input));
  }

  async createEmployee(
    context: RequestContext,
    input: CreateTenantAdminEmployeeRequest,
  ): Promise<TenantAdminEmployeeOptionDto> {
    const tenantContext = requireTenantAdminContext(context);
    if (!this.config.supabaseUrl || !this.config.supabaseAdminKey) {
      throw new ServiceUnavailableException({
        code: "AUTH_PROVISIONING_UNAVAILABLE",
        message: "Employee account provisioning is unavailable.",
      });
    }
    const email = input.email.trim().toLowerCase();
    const client = createSupabaseClient(this.config.supabaseUrl, this.config.supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.name,
        portal: "employee",
      },
    });
    if (error || !data.user) {
      throw new ConflictException({
        code: "EMPLOYEE_EMAIL_EXISTS",
        message: "This email is already associated with an existing account.",
      });
    }
    try {
      return await this.repository.createEmployee(tenantContext, { ...input, email }, data.user.id);
    } catch (provisioningError) {
      await client.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      throw provisioningError;
    }
  }

  async listEmployees(context: RequestContext): Promise<TenantAdminEmployeesResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    return { employees: await this.repository.listEmployees(tenantContext) };
  }

  async setEmployeeManagerRole(
    context: RequestContext,
    employeeId: string,
    isManager: boolean,
  ): Promise<TenantAdminEmployeeOptionDto> {
    const tenantContext = requireTenantAdminContext(context);
    return this.repository.setEmployeeManagerRole(tenantContext, employeeId, isManager);
  }

  async updateEmployeeCapacity(
    context: RequestContext,
    employeeId: string,
    input: UpdateTenantAdminEmployeeCapacityRequest,
  ): Promise<TenantAdminEmployeeOptionDto> {
    const tenantContext = requireTenantAdminContext(context);
    return this.repository.updateEmployeeCapacity(tenantContext, employeeId, input.weeklyCapacityHours);
  }

  async listWorkGroups(context: RequestContext): Promise<TenantAdminWorkGroupsResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    return { workGroups: await this.repository.listWorkGroups(tenantContext) };
  }

  async createWorkGroup(
    context: RequestContext,
    input: UpsertTenantAdminWorkGroupRequest,
  ): Promise<TenantAdminWorkGroupDto> {
    const tenantContext = requireTenantAdminContext(context);
    return this.repository.createWorkGroup(tenantContext, input);
  }

  async updateWorkGroup(
    context: RequestContext,
    workGroupId: string,
    input: UpsertTenantAdminWorkGroupRequest,
  ): Promise<TenantAdminWorkGroupDto> {
    const tenantContext = requireTenantAdminContext(context);
    return this.repository.updateWorkGroup(tenantContext, workGroupId, input);
  }
}

function mapTask(row: TenantAdminTaskRow): TenantAdminTaskItemDto {
  return {
    ...row,
    plannedDueAt: row.plannedDueAt ? row.plannedDueAt.toISOString() : null,
  };
}
