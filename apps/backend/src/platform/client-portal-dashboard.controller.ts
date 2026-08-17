import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  ClientPortalDashboardQuery,
  ClientPortalDashboardResponseDto,
  clientPortalDashboardQuerySchema,
} from "./client-portal-dashboard.dto";
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
  @ApiQuery({ name: "from", required: false, type: String, example: "2026-08-01" })
  @ApiQuery({ name: "to", required: false, type: String, example: "2026-08-31" })
  @ApiOkResponse({ type: ClientPortalDashboardResponseDto })
  read(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(clientPortalDashboardQuerySchema)) query: ClientPortalDashboardQuery,
  ): Promise<ClientPortalDashboardResponseDto> {
    return this.service.read(context, query);
  }
}
