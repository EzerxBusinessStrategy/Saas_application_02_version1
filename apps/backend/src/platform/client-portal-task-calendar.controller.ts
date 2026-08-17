import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  ClientPortalTaskCalendarQuery,
  ClientPortalTaskCalendarResponseDto,
  clientPortalTaskCalendarQuerySchema,
} from "./client-portal-task-calendar.dto";
import { ClientPortalTaskCalendarService } from "./client-portal-task-calendar.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/task-calendar")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalTaskCalendarController {
  constructor(
    @Inject(ClientPortalTaskCalendarService)
    private readonly service: ClientPortalTaskCalendarService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Return scheduled tasks for the authenticated client account calendar." })
  @ApiOkResponse({ type: ClientPortalTaskCalendarResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(clientPortalTaskCalendarQuerySchema)) query: ClientPortalTaskCalendarQuery,
  ): Promise<ClientPortalTaskCalendarResponseDto> {
    return this.service.list(context, query);
  }
}
