import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  EmployeeTaskDto,
  EmployeeTasksResponseDto,
  EmployeeWorkLogsResponseDto,
  submitEmployeeTaskSchema,
  SubmitEmployeeTaskRequest,
} from "./employee-tasks.dto";
import { EmployeeTasksService } from "./employee-tasks.service";

@ApiTags("Employee")
@ApiBearerAuth()
@Controller("employee")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
export class EmployeeTasksController {
  constructor(@Inject(EmployeeTasksService) private readonly service: EmployeeTasksService) {}

  @Get("tasks")
  @RequirePermissions("task.read.assigned")
  @ApiOperation({ summary: "Return assigned tasks for the logged-in employee." })
  @ApiOkResponse({ type: EmployeeTasksResponseDto })
  list(@CurrentRequestContext() context: RequestContext): Promise<EmployeeTasksResponseDto> {
    return this.service.list(context);
  }

  @Get("work-logs")
  @RequirePermissions("task.read.assigned")
  @ApiOperation({ summary: "Return work logs generated from employee task work segments." })
  @ApiOkResponse({ type: EmployeeWorkLogsResponseDto })
  workLogs(@CurrentRequestContext() context: RequestContext): Promise<EmployeeWorkLogsResponseDto> {
    return this.service.workLogs(context);
  }

  @Post("tasks/:taskId/start")
  @RequirePermissions("task.update_status.assigned")
  @ApiOkResponse({ type: EmployeeTaskDto })
  start(@CurrentRequestContext() context: RequestContext, @Param("taskId") taskId: string): Promise<EmployeeTaskDto> {
    return this.service.start(context, taskId);
  }

  @Post("tasks/:taskId/pause")
  @RequirePermissions("task.update_status.assigned")
  @ApiOkResponse({ type: EmployeeTaskDto })
  pause(@CurrentRequestContext() context: RequestContext, @Param("taskId") taskId: string): Promise<EmployeeTaskDto> {
    return this.service.pause(context, taskId);
  }

  @Post("tasks/:taskId/resume")
  @RequirePermissions("task.update_status.assigned")
  @ApiOkResponse({ type: EmployeeTaskDto })
  resume(@CurrentRequestContext() context: RequestContext, @Param("taskId") taskId: string): Promise<EmployeeTaskDto> {
    return this.service.resume(context, taskId);
  }

  @Post("tasks/:taskId/submit")
  @RequirePermissions("task.update_status.assigned")
  @ApiOkResponse({ type: EmployeeTaskDto })
  submit(
    @CurrentRequestContext() context: RequestContext,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(submitEmployeeTaskSchema)) body: SubmitEmployeeTaskRequest,
  ): Promise<EmployeeTaskDto> {
    return this.service.submit(context, taskId, body.taskComment);
  }
}
