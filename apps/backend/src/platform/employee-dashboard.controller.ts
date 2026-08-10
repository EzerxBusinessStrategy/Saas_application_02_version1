import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { EmployeeDashboardResponseDto } from "./employee-dashboard.dto";
import { EmployeeDashboardService } from "./employee-dashboard.service";

@ApiTags("Employee")
@ApiBearerAuth()
@Controller("employee/dashboard")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("task.read.assigned")
export class EmployeeDashboardController {
  constructor(
    @Inject(EmployeeDashboardService)
    private readonly service: EmployeeDashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Return today's dashboard for the logged-in employee." })
  @ApiOkResponse({ type: EmployeeDashboardResponseDto })
  read(@CurrentRequestContext() context: RequestContext): Promise<EmployeeDashboardResponseDto> {
    return this.service.read(context);
  }
}
