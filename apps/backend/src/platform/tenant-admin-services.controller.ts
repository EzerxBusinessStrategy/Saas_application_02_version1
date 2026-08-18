import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  tenantAdminServiceCreateSchema,
  tenantAdminServiceAllocationsQuerySchema,
  tenantAdminServiceTaskStatusSchema,
  tenantAdminServiceStatusSchema,
  TenantAdminServiceAllocationsQuery,
  TenantAdminServiceAllocationsResponseDto,
  TenantAdminServiceCreateRequest,
  TenantAdminServiceDto,
  TenantAdminServicesResponseDto,
  TenantAdminServiceStatusRequest,
  TenantAdminServiceStatusResponseDto,
  TenantAdminServiceTaskStatusRequest,
  TenantAdminServiceTaskStatusResponseDto,
} from "./tenant-admin-services.dto";
import { TenantAdminServicesService } from "./tenant-admin-services.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/services")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminServicesController {
  constructor(
    @Inject(TenantAdminServicesService)
    private readonly service: TenantAdminServicesService,
  ) {}

  @Get()
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return tenant-scoped services with active rate-card items." })
  @ApiOkResponse({ type: TenantAdminServicesResponseDto })
  list(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminServicesResponseDto> {
    return this.service.list(context);
  }

  @Post()
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Create a tenant-scoped service with a reusable default rate." })
  @ApiOkResponse({ type: TenantAdminServiceDto })
  create(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(tenantAdminServiceCreateSchema)) body: TenantAdminServiceCreateRequest,
  ): Promise<TenantAdminServiceDto> {
    return this.service.create(context, body);
  }

  @Patch(":serviceId/status")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Enable or disable a tenant-scoped catalogue service." })
  @ApiOkResponse({ type: TenantAdminServiceStatusResponseDto })
  setStatus(
    @CurrentRequestContext() context: RequestContext,
    @Param("serviceId", new ParseUUIDPipe()) serviceId: string,
    @Body(new ZodValidationPipe(tenantAdminServiceStatusSchema)) body: TenantAdminServiceStatusRequest,
  ): Promise<TenantAdminServiceStatusResponseDto> {
    return this.service.setStatus(context, serviceId, body);
  }

  @Patch(":serviceId/rate-items/:rateItemId/status")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Enable or disable one tenant-default service task rate." })
  @ApiOkResponse({ type: TenantAdminServiceTaskStatusResponseDto })
  setTaskStatus(
    @CurrentRequestContext() context: RequestContext,
    @Param("serviceId", new ParseUUIDPipe()) serviceId: string,
    @Param("rateItemId", new ParseUUIDPipe()) rateItemId: string,
    @Body(new ZodValidationPipe(tenantAdminServiceTaskStatusSchema)) body: TenantAdminServiceTaskStatusRequest,
  ): Promise<TenantAdminServiceTaskStatusResponseDto> {
    return this.service.setTaskStatus(context, serviceId, rateItemId, body);
  }

  @Get(":serviceId/allocations")
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return client and employee allocations for service task rates." })
  @ApiOkResponse({ type: TenantAdminServiceAllocationsResponseDto })
  getAllocations(
    @CurrentRequestContext() context: RequestContext,
    @Param("serviceId", new ParseUUIDPipe()) serviceId: string,
    @Query(new ZodValidationPipe(tenantAdminServiceAllocationsQuerySchema)) query: TenantAdminServiceAllocationsQuery,
  ): Promise<TenantAdminServiceAllocationsResponseDto> {
    return this.service.getAllocations(context, serviceId, query);
  }
}

