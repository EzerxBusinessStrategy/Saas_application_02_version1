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
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  createTenantAdminTaskSchema,
  createTenantAdminEmployeeSchema,
  CreateTenantAdminEmployeeRequest,
  CreateTenantAdminTaskRequest,
  listTenantAdminTasksQuerySchema,
  ListTenantAdminTasksQuery,
  TenantAdminTaskItemDto,
  TenantAdminEmployeeOptionDto,
  TenantAdminEmployeesResponseDto,
  TenantAdminTaskOptionsResponseDto,
  TenantAdminTasksResponseDto,
  updateTenantAdminEmployeeCapacitySchema,
  UpdateTenantAdminEmployeeCapacityRequest,
  TenantAdminWorkGroupDto,
  TenantAdminWorkGroupsResponseDto,
  upsertTenantAdminWorkGroupSchema,
  UpsertTenantAdminWorkGroupRequest,
} from "./tenant-admin-tasks.dto";
import { TenantAdminTasksService } from "./tenant-admin-tasks.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/tasks")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
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

  @Get("employees")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Return tenant-scoped employees for task and workforce screens." })
  @ApiOkResponse({ type: TenantAdminEmployeesResponseDto })
  listEmployees(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminEmployeesResponseDto> {
    return this.service.listEmployees(context);
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
