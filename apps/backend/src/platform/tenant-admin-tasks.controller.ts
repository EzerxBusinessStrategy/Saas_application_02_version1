import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  createTenantAdminTaskSchema,
  decideTenantAdminTaskApprovalSchema,
  createTenantAdminEmployeeSchema,
  createTenantAdminDepartmentSchema,
  CreateTenantAdminDepartmentRequest,
  CreateTenantAdminEmployeeRequest,
  CreateTenantAdminTaskRequest,
  TenantAdminTaskApprovalRequest,
  listTenantAdminTasksQuerySchema,
  ListTenantAdminTasksQuery,
  TenantAdminTaskItemDto,
  TaskReviewDetailDto,
  TenantAdminEmployeeOptionDto,
  TenantAdminEmployeeEmailAvailabilityDto,
  TenantAdminEmployeesResponseDto,
  TenantAdminDepartmentDto,
  TenantAdminDepartmentsResponseDto,
  TenantAdminTaskOptionsResponseDto,
  TenantAdminTasksResponseDto,
  updateTenantAdminEmployeeCapacitySchema,
  UpdateTenantAdminEmployeeCapacityRequest,
  updateTenantAdminEmployeeAssignmentSchema,
  UpdateTenantAdminEmployeeAssignmentRequest,
  TenantAdminWorkGroupDto,
  TenantAdminWorkGroupsResponseDto,
  upsertTenantAdminWorkGroupSchema,
  UpsertTenantAdminWorkGroupRequest,
} from "./tenant-admin-tasks.dto";
import { TenantAdminTasksService } from "./tenant-admin-tasks.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/tasks")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminTasksController {
  constructor(
    @Inject(TenantAdminTasksService)
    private readonly service: TenantAdminTasksService,
  ) {}

  @Get("options")
  @RequirePermissions("task.create")
  @ApiOperation({ summary: "Return tenant-scoped clients, services, employees and work groups for task creation." })
  @ApiOkResponse({ type: TenantAdminTaskOptionsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  getOptions(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminTaskOptionsResponseDto> {
    return this.service.getOptions(context);
  }

  @Get()
  @RequirePermissions("task.read")
  @ApiOperation({ summary: "Return tenant-scoped tasks for the authenticated Tenant Admin." })
  @ApiOkResponse({ type: TenantAdminTasksResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  listTasks(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(listTenantAdminTasksQuerySchema)) query: ListTenantAdminTasksQuery,
  ): Promise<TenantAdminTasksResponseDto> {
    return this.service.listTasks(context, query.clientId);
  }

  @Get(":taskId/review-detail")
  @RequirePermissions("task.read")
  @ApiOperation({ summary: "Return tenant-scoped task submission evidence and review history." })
  @ApiOkResponse({ type: TaskReviewDetailDto })
  getReviewDetail(
    @CurrentRequestContext() context: RequestContext,
    @Param("taskId") taskId: string,
  ): Promise<TaskReviewDetailDto> {
    return this.service.getReviewDetail(context, taskId);
  }

  @Post()
  @RequirePermissions("task.create")
  @ApiOperation({ summary: "Create a tenant-scoped task and optional employee assignments." })
  @ApiOkResponse({ type: TenantAdminTaskItemDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  createTask(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTenantAdminTaskSchema)) body: CreateTenantAdminTaskRequest,
  ): Promise<TenantAdminTaskItemDto> {
    return this.service.createTask(context, body);
  }

  @Post(":taskId/approval")
  @RequirePermissions("task.approve")
  @ApiOperation({ summary: "Record the authenticated Tenant Admin's final task approval or return decision." })
  @ApiOkResponse({ type: TenantAdminTaskItemDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  decideTaskApproval(
    @CurrentRequestContext() context: RequestContext,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(decideTenantAdminTaskApprovalSchema)) body: TenantAdminTaskApprovalRequest,
  ): Promise<TenantAdminTaskItemDto> {
    return this.service.decideTaskApproval(context, taskId, body);
  }

  @Post("employees")
  @RequirePermissions("task.create")
  @ApiOperation({ summary: "Create an active employee option for tenant task assignment." })
  @ApiOkResponse({ type: TenantAdminEmployeeOptionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  createEmployee(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTenantAdminEmployeeSchema)) body: CreateTenantAdminEmployeeRequest,
  ): Promise<TenantAdminEmployeeOptionDto> {
    return this.service.createEmployee(context, body);
  }

  @Get("employees/email-availability")
  @RequirePermissions("task.create")
  @ApiOperation({ summary: "Check whether an employee email is available in the application database." })
  @ApiOkResponse({ type: TenantAdminEmployeeEmailAvailabilityDto })
  getEmployeeEmailAvailability(
    @CurrentRequestContext() context: RequestContext,
    @Query("email") email: string,
  ) {
    return this.service.getEmployeeEmailAvailability(context, email);
  }

  @Get("employees")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Return tenant-scoped employees for task and workforce screens." })
  @ApiOkResponse({ type: TenantAdminEmployeesResponseDto })
  listEmployees(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminEmployeesResponseDto> {
    return this.service.listEmployees(context);
  }

  @Get("departments")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Return tenant-scoped departments and their current employees." })
  @ApiOkResponse({ type: TenantAdminDepartmentsResponseDto })
  listDepartments(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminDepartmentsResponseDto> {
    return this.service.listDepartments(context);
  }

  @Post("departments")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Create an active department in the authenticated tenant." })
  @ApiOkResponse({ type: TenantAdminDepartmentDto })
  createDepartment(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTenantAdminDepartmentSchema)) body: CreateTenantAdminDepartmentRequest,
  ): Promise<TenantAdminDepartmentDto> {
    return this.service.createDepartment(context, body);
  }

  @Patch("employees/:employeeId/assignment")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Update an employee's department, skills, level, and manager assignment." })
  @ApiOkResponse({ type: TenantAdminEmployeeOptionDto })
  updateEmployeeAssignment(
    @CurrentRequestContext() context: RequestContext,
    @Param("employeeId") employeeId: string,
    @Body(new ZodValidationPipe(updateTenantAdminEmployeeAssignmentSchema)) body: UpdateTenantAdminEmployeeAssignmentRequest,
  ): Promise<TenantAdminEmployeeOptionDto> {
    return this.service.updateEmployeeAssignment(context, employeeId, body);
  }

  @Patch("employees/:employeeId/manager")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Assign the Manager role to an employee." })
  @ApiOkResponse({ type: TenantAdminEmployeeOptionDto })
  makeManager(
    @CurrentRequestContext() context: RequestContext,
    @Param("employeeId") employeeId: string,
  ): Promise<TenantAdminEmployeeOptionDto> {
    return this.service.setEmployeeManagerRole(context, employeeId, true);
  }

  @Delete("employees/:employeeId/manager")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Remove the Manager role from an employee." })
  @ApiOkResponse({ type: TenantAdminEmployeeOptionDto })
  removeManager(
    @CurrentRequestContext() context: RequestContext,
    @Param("employeeId") employeeId: string,
  ): Promise<TenantAdminEmployeeOptionDto> {
    return this.service.setEmployeeManagerRole(context, employeeId, false);
  }

  @Patch("employees/:employeeId/capacity")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Update weekly employee capacity in hours." })
  @ApiOkResponse({ type: TenantAdminEmployeeOptionDto })
  updateEmployeeCapacity(
    @CurrentRequestContext() context: RequestContext,
    @Param("employeeId") employeeId: string,
    @Body(new ZodValidationPipe(updateTenantAdminEmployeeCapacitySchema)) body: UpdateTenantAdminEmployeeCapacityRequest,
  ): Promise<TenantAdminEmployeeOptionDto> {
    return this.service.updateEmployeeCapacity(context, employeeId, body);
  }

  @Get("work-groups")
  @RequirePermissions("task.read")
  @ApiOperation({ summary: "Return tenant-scoped work groups." })
  @ApiOkResponse({ type: TenantAdminWorkGroupsResponseDto })
  listWorkGroups(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminWorkGroupsResponseDto> {
    return this.service.listWorkGroups(context);
  }

  @Post("work-groups")
  @RequirePermissions("task.create")
  @ApiOperation({ summary: "Create a tenant-scoped work group." })
  @ApiOkResponse({ type: TenantAdminWorkGroupDto })
  createWorkGroup(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(upsertTenantAdminWorkGroupSchema)) body: UpsertTenantAdminWorkGroupRequest,
  ): Promise<TenantAdminWorkGroupDto> {
    return this.service.createWorkGroup(context, body);
  }

  @Patch("work-groups/:workGroupId")
  @RequirePermissions("task.create")
  @ApiOperation({ summary: "Update a tenant-scoped work group and memberships." })
  @ApiOkResponse({ type: TenantAdminWorkGroupDto })
  updateWorkGroup(
    @CurrentRequestContext() context: RequestContext,
    @Param("workGroupId") workGroupId: string,
    @Body(new ZodValidationPipe(upsertTenantAdminWorkGroupSchema)) body: UpsertTenantAdminWorkGroupRequest,
  ): Promise<TenantAdminWorkGroupDto> {
    return this.service.updateWorkGroup(context, workGroupId, body);
  }
}
