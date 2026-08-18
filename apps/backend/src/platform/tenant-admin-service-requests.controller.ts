import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  AcceptClientServiceRequest,
  acceptClientServiceRequestSchema,
  ClientServiceRequestDto,
  ClientServiceRequestListResponseDto,
  ListTenantServiceRequestsQuery,
  listTenantServiceRequestsQuerySchema,
  RejectClientServiceRequest,
  rejectClientServiceRequestSchema,
} from "./client-service-requests.dto";
import { ClientServiceRequestsService } from "./client-service-requests.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/service-requests")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminServiceRequestsController {
  constructor(
    @Inject(ClientServiceRequestsService)
    private readonly service: ClientServiceRequestsService,
  ) {}

  @Get()
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "List client catalogue and custom service requests for the tenant." })
  @ApiOkResponse({ type: ClientServiceRequestListResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(listTenantServiceRequestsQuerySchema)) query: ListTenantServiceRequestsQuery,
  ): Promise<ClientServiceRequestListResponseDto> {
    return this.service.listForTenant(context, query);
  }

  @Get(":requestId")
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return one client service request, including the booklet snapshot." })
  @ApiOkResponse({ type: ClientServiceRequestDto })
  get(
    @CurrentRequestContext() context: RequestContext,
    @Param("requestId") requestId: string,
  ): Promise<ClientServiceRequestDto> {
    return this.service.getForTenant(context, requestId);
  }

  @Post(":requestId/accept")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Accept a request, allot employees, and activate through the existing engine." })
  @ApiOkResponse({ type: ClientServiceRequestDto })
  accept(
    @CurrentRequestContext() context: RequestContext,
    @Param("requestId") requestId: string,
    @Body(new ZodValidationPipe(acceptClientServiceRequestSchema)) body: AcceptClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.service.accept(context, requestId, body);
  }

  @Post(":requestId/reject")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Reject a submitted client service request." })
  @ApiOkResponse({ type: ClientServiceRequestDto })
  reject(
    @CurrentRequestContext() context: RequestContext,
    @Param("requestId") requestId: string,
    @Body(new ZodValidationPipe(rejectClientServiceRequestSchema)) body: RejectClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.service.reject(context, requestId, body);
  }
}
