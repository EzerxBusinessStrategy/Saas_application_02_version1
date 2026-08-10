import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { TenantAdminTaskItemDto } from "./tenant-admin-tasks.dto";
import {
  employeeManagerCreateTaskSchema,
  employeeManagerReviewSchema,
  EmployeeManagerClientsResponseDto,
  EmployeeManagerCreateTaskRequest,
  EmployeeManagerReviewRequest,
  EmployeeManagerReviewsResponseDto,
  EmployeeManagerTaskOptionsResponseDto,
} from "./employee-manager.dto";
import { EmployeeManagerService } from "./employee-manager.service";

@ApiTags("Employee Manager")
@ApiBearerAuth()
@Controller("employee/manager")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
export class EmployeeManagerController {
  constructor(@Inject(EmployeeManagerService) private readonly service: EmployeeManagerService) {}

  @Get("clients")
  @RequirePermissions("client.read")
  @ApiOkResponse({ type: EmployeeManagerClientsResponseDto })
  listClients(@CurrentRequestContext() context: RequestContext): Promise<EmployeeManagerClientsResponseDto> {
    return this.service.listClients(context);
  }

  @Get("task-options")
  @RequirePermissions("task.create")
  @ApiOkResponse({ type: EmployeeManagerTaskOptionsResponseDto })
  getOptions(@CurrentRequestContext() context: RequestContext): Promise<EmployeeManagerTaskOptionsResponseDto> {
    return this.service.getOptions(context);
  }

  @Get("reviews")
  @RequirePermissions("work_log.review.assigned_group")
  @ApiOkResponse({ type: EmployeeManagerReviewsResponseDto })
  listReviews(@CurrentRequestContext() context: RequestContext): Promise<EmployeeManagerReviewsResponseDto> {
    return this.service.listReviews(context);
  }

  @Post("tasks")
  @RequirePermissions("task.create")
  @ApiOkResponse({ type: TenantAdminTaskItemDto })
  createTask(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(employeeManagerCreateTaskSchema)) body: EmployeeManagerCreateTaskRequest,
  ): Promise<TenantAdminTaskItemDto> {
    return this.service.createTask(context, body);
  }

  @Post("reviews/:taskId")
  @RequirePermissions("work_log.review.assigned_group")
  decideReview(
    @CurrentRequestContext() context: RequestContext,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(employeeManagerReviewSchema)) body: EmployeeManagerReviewRequest,
  ): Promise<{ ok: true }> {
    return this.service.decideReview(context, taskId, body);
  }
}
