import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { EmployeeProfileDto } from "./employee-profile.dto";
import { EmployeeProfileService } from "./employee-profile.service";

@ApiTags("Employee")
@ApiBearerAuth()
@Controller("employee/profile")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class EmployeeProfileController {
  constructor(@Inject(EmployeeProfileService) private readonly service: EmployeeProfileService) {}

  @Get()
  @RequirePermissions("task.read.assigned")
  @ApiOperation({ summary: "Return the logged-in employee profile." })
  @ApiOkResponse({ type: EmployeeProfileDto })
  get(@CurrentRequestContext() context: RequestContext): Promise<EmployeeProfileDto> {
    return this.service.get(context);
  }
}
