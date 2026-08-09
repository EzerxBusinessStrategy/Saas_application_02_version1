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
  ClientPortalDeliverableDto,
  ClientPortalDeliverablesResponseDto,
  DecideClientPortalDeliverableRequest,
  decideClientPortalDeliverableSchema,
} from "./client-portal-deliverables.dto";
import { ClientPortalDeliverablesService } from "./client-portal-deliverables.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/deliverables")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalDeliverablesController {
  constructor(
    @Inject(ClientPortalDeliverablesService)
    private readonly service: ClientPortalDeliverablesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Return deliverables for the logged-in client account." })
  @ApiOkResponse({ type: ClientPortalDeliverablesResponseDto })
  list(@CurrentRequestContext() context: RequestContext): Promise<ClientPortalDeliverablesResponseDto> {
    return this.service.list(context);
  }

  @Post(":documentId/decision")
  @ApiOperation({ summary: "Approve or reject one client deliverable." })
  @ApiOkResponse({ type: ClientPortalDeliverableDto })
  decide(
    @CurrentRequestContext() context: RequestContext,
    @Param("documentId") documentId: string,
    @Body(new ZodValidationPipe(decideClientPortalDeliverableSchema)) body: DecideClientPortalDeliverableRequest,
  ): Promise<ClientPortalDeliverableDto> {
    return this.service.decide(context, documentId, body);
  }
}
