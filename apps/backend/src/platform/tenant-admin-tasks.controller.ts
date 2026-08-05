import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
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
  CreateTenantAdminTaskRequest,
  listTenantAdminTasksQuerySchema,
  ListTenantAdminTasksQuery,
  TenantAdminTaskItemDto,
  TenantAdminTaskOptionsResponseDto,
  TenantAdminTasksResponseDto,
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
}
