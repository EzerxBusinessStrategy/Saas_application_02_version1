import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ClientPortalDashboardResponseDto } from "./client-portal-dashboard.dto";
import { ClientPortalDashboardService } from "./client-portal-dashboard.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/dashboard")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalDashboardController {
  constructor(
    @Inject(ClientPortalDashboardService)
    private readonly service: ClientPortalDashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Return dashboard data for the logged-in client account." })
  @ApiOkResponse({ type: ClientPortalDashboardResponseDto })
  read(
    @CurrentRequestContext() context: RequestContext,
  ): Promise<ClientPortalDashboardResponseDto> {
    return this.service.read(context);
  }
}
