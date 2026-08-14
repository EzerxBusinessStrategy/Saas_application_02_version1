import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { PasswordService } from "../auth/core/password.service";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  CreateTenantAdminTaskRequest,
  CreateTenantAdminDepartmentRequest,
  CreateTenantAdminEmployeeRequest,
  TenantAdminEmployeeOptionDto,
  TenantAdminTaskItemDto,
  TenantAdminTaskApprovalRequest,
  TaskReviewDetailDto,
  TenantAdminTaskOptionsResponseDto,
  TenantAdminTasksResponseDto,
  TenantAdminEmployeesResponseDto,
  TenantAdminDepartmentDto,
  TenantAdminDepartmentsResponseDto,
  TenantAdminWorkGroupDto,
  TenantAdminWorkGroupsResponseDto,
  UpdateTenantAdminEmployeeAssignmentRequest,
  UpdateTenantAdminEmployeeCapacityRequest,
  UpsertTenantAdminWorkGroupRequest,
} from "./tenant-admin-tasks.dto";
import { TaskReviewDetailRow, TenantAdminTaskRow, TenantAdminTasksRepository } from "./tenant-admin-tasks.repository";

@Injectable()
export class TenantAdminTasksService {
  constructor(
    @Inject(TenantAdminTasksRepository)
    private readonly repository: TenantAdminTasksRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
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

  async decideTaskApproval(
    context: RequestContext,
    taskId: string,
    input: TenantAdminTaskApprovalRequest,
  ): Promise<TenantAdminTaskItemDto> {
    return mapTask(await this.repository.decideTaskApproval(requireTenantAdminContext(context), taskId, input));
  }

  async createEmployee(
    context: RequestContext,
    input: CreateTenantAdminEmployeeRequest,
  ): Promise<TenantAdminEmployeeOptionDto> {
    const tenantContext = requireTenantAdminContext(context);
    const email = input.email.trim().toLowerCase();
    if (await this.repository.userEmailExists(tenantContext, email)) {
      throw new ConflictException({
        code: "EMPLOYEE_EMAIL_EXISTS",
        message: "This email is already associated with an existing account.",
      });
    }
    return this.repository.createEmployee(tenantContext, { ...input, email }, await this.passwords.hash(input.password));
  }

  async getEmployeeEmailAvailability(context: RequestContext, email: string) {
    const tenantContext = requireTenantAdminContext(context);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestException({ code: "INVALID_EMAIL", message: "Enter a valid email address." });
    }
    const exists = await this.repository.userEmailExists(tenantContext, normalizedEmail);
    return exists ? { available: false, reason: "EMAIL_ALREADY_EXISTS" as const } : { available: true };
  }

  async listEmployees(context: RequestContext): Promise<TenantAdminEmployeesResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    return this.repository.listEmployees(tenantContext);
  }

  async getReviewDetail(context: RequestContext, taskId: string): Promise<TaskReviewDetailDto> {
    return mapReviewDetail(await this.repository.getReviewDetail(requireTenantAdminContext(context), taskId));
  }

  async listDepartments(context: RequestContext): Promise<TenantAdminDepartmentsResponseDto> {
    return this.repository.listDepartments(requireTenantAdminContext(context));
  }

  async createDepartment(
    context: RequestContext,
    input: CreateTenantAdminDepartmentRequest,
  ): Promise<TenantAdminDepartmentDto> {
    return this.repository.createDepartment(requireTenantAdminContext(context), input);
  }

  async updateEmployeeAssignment(
    context: RequestContext,
    employeeId: string,
    input: UpdateTenantAdminEmployeeAssignmentRequest,
  ): Promise<TenantAdminEmployeeOptionDto> {
    return this.repository.updateEmployeeAssignment(requireTenantAdminContext(context), employeeId, input);
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

function mapReviewDetail(row: TaskReviewDetailRow): TaskReviewDetailDto {
  return {
    task: mapTask(row.task),
    comments: row.comments.map((comment) => ({
      id: comment.id,
      author: comment.author,
      kind: comment.kind,
      message: comment.message,
      createdAt: comment.createdAt.toISOString(),
    })),
    workLogs: row.workLogs.map((log) => ({
      id: log.id,
      employee: log.employee,
      workedSeconds: log.workedSeconds,
      startedAt: log.startedAt.toISOString(),
      endedAt: log.endedAt?.toISOString() ?? null,
    })),
    attachments: row.attachments.map((attachment) => ({
      id: attachment.id,
      title: attachment.title,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      sizeBytes: attachment.sizeBytes,
      uploadedBy: attachment.uploadedBy,
      updatedAt: attachment.updatedAt.toISOString(),
    })),
  };
}
