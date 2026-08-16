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
  ClientServiceCatalogueQuery,
  clientServiceCatalogueQuerySchema,
  ClientServiceCatalogueResponseDto,
  ClientServiceRequestDto,
  ClientServiceRequestListResponseDto,
  CreateClientServiceRequest,
  createClientServiceRequestSchema,
} from "./client-service-requests.dto";
import { ClientServiceRequestsService } from "./client-service-requests.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalServiceRequestsController {
  constructor(
    @Inject(ClientServiceRequestsService)
    private readonly service: ClientServiceRequestsService,
  ) {}

  @Get("service-catalogue")
  @ApiOperation({ summary: "Return tenant service booklets the authenticated client can request." })
  @ApiOkResponse({ type: ClientServiceCatalogueResponseDto })
  catalogue(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(clientServiceCatalogueQuerySchema)) query: ClientServiceCatalogueQuery,
  ): Promise<ClientServiceCatalogueResponseDto> {
    return this.service.getCatalogue(context, query);
  }

  @Get("service-requests")
  @ApiOperation({ summary: "List catalogue and custom service requests for the authenticated client." })
  @ApiOkResponse({ type: ClientServiceRequestListResponseDto })
  list(@CurrentRequestContext() context: RequestContext): Promise<ClientServiceRequestListResponseDto> {
    return this.service.listForClient(context);
  }

  @Post("service-requests")
  @ApiOperation({ summary: "Submit a catalogue tick-and-send request or a custom request. Does not create tasks." })
  @ApiOkResponse({ type: ClientServiceRequestDto })
  create(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createClientServiceRequestSchema)) body: CreateClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.service.create(context, body);
  }
}
