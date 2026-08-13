import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  ClientPortalRequestCreatedDto,
  ClientPortalRequestOptionsResponseDto,
  CreateClientPortalRequest,
  createClientPortalRequestSchema,
} from "./client-portal-requests.dto";
import { ClientPortalRequestsService } from "./client-portal-requests.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/requests")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalRequestsController {
  constructor(
    @Inject(ClientPortalRequestsService)
    private readonly service: ClientPortalRequestsService,
  ) {}

  @Get("options")
  @ApiOperation({ summary: "Return tenant services available for client requests." })
  @ApiOkResponse({ type: ClientPortalRequestOptionsResponseDto })
  options(@CurrentRequestContext() context: RequestContext): Promise<ClientPortalRequestOptionsResponseDto> {
    return this.service.options(context);
  }

  @Post()
  @ApiOperation({ summary: "Create a client service request." })
  @ApiOkResponse({ type: ClientPortalRequestCreatedDto })
  create(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createClientPortalRequestSchema)) body: CreateClientPortalRequest,
  ): Promise<ClientPortalRequestCreatedDto> {
    return this.service.create(context, body);
  }
}
