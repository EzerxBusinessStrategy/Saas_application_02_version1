import { Body, Controller, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  ClientServiceCommentDto,
  CreateClientServiceComment,
  createClientServiceCommentSchema,
} from "./client-portal-service-comments.dto";
import { ClientPortalServiceCommentsService } from "./client-portal-service-comments.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/services")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalServiceCommentsController {
  constructor(
    @Inject(ClientPortalServiceCommentsService)
    private readonly service: ClientPortalServiceCommentsService,
  ) {}

  @Post(":serviceId/comments")
  @ApiOperation({
    summary: "Send a comment on an active client service. Tenant Admins and Owners are notified with the client name.",
  })
  @ApiOkResponse({ type: ClientServiceCommentDto })
  create(
    @CurrentRequestContext() context: RequestContext,
    @Param("serviceId", new ParseUUIDPipe()) serviceId: string,
    @Body(new ZodValidationPipe(createClientServiceCommentSchema)) body: CreateClientServiceComment,
  ): Promise<ClientServiceCommentDto> {
    return this.service.create(context, serviceId, body);
  }
}
