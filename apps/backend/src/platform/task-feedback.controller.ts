import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  ClientTaskFeedbackDto,
  PendingTaskFeedbackResponseDto,
  SubmitClientTaskFeedback,
  submitClientTaskFeedbackSchema,
  TaskFeedbackLogResponseDto,
  taskFeedbackLogQuerySchema,
  TaskFeedbackLogQuery,
} from "./task-feedback.dto";
import { TaskFeedbackService } from "./task-feedback.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/task-feedback")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalTaskFeedbackController {
  constructor(@Inject(TaskFeedbackService) private readonly service: TaskFeedbackService) {}

  @Get("pending")
  @ApiOperation({ summary: "List tasks awaiting client feedback after invoice delivery." })
  @ApiOkResponse({ type: PendingTaskFeedbackResponseDto })
  listPending(@CurrentRequestContext() context: RequestContext): Promise<PendingTaskFeedbackResponseDto> {
    return this.service.listPending(context);
  }

  @Post()
  @ApiOperation({ summary: "Submit star ratings for a completed task after invoice delivery." })
  @ApiOkResponse({ type: ClientTaskFeedbackDto })
  submit(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(submitClientTaskFeedbackSchema)) body: SubmitClientTaskFeedback,
  ): Promise<ClientTaskFeedbackDto> {
    return this.service.submit(context, body);
  }
}

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/task-feedback")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminTaskFeedbackController {
  constructor(@Inject(TaskFeedbackService) private readonly service: TaskFeedbackService) {}

  @Get()
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "List all client task feedback for performance review." })
  @ApiOkResponse({ type: TaskFeedbackLogResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(taskFeedbackLogQuerySchema)) query: TaskFeedbackLogQuery,
  ) {
    return this.service.listTenantLog(context, query);
  }
}

@ApiTags("Employee")
@ApiBearerAuth()
@Controller("employee/task-feedback")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class EmployeeTaskFeedbackController {
  constructor(@Inject(TaskFeedbackService) private readonly service: TaskFeedbackService) {}

  @Get()
  @RequirePermissions("task.read.assigned")
  @ApiOperation({ summary: "List feedback received for the authenticated employee only." })
  @ApiOkResponse({ type: TaskFeedbackLogResponseDto })
  list(@CurrentRequestContext() context: RequestContext) {
    return this.service.listEmployeeLog(context);
  }
}
