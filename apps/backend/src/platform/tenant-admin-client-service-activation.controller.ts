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
  activateClientServicesSchema,
  ActivateClientServicesRequest,
  ActivateClientServicesResponseDto,
  serviceOnboardingAssigneesQuerySchema,
  ServiceOnboardingAssigneesQuery,
  ServiceOnboardingAssigneesResponseDto,
  ServiceOnboardingCatalogResponseDto,
} from "./tenant-admin-client-service-activation.dto";
import { TenantAdminClientServiceActivationService } from "./tenant-admin-client-service-activation.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/clients")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminClientServiceActivationController {
  constructor(
    @Inject(TenantAdminClientServiceActivationService)
    private readonly service: TenantAdminClientServiceActivationService,
  ) {}

  @Get(":clientId/service-onboarding/catalog")
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return selectable service booklets for a client." })
  @ApiOkResponse({ type: ServiceOnboardingCatalogResponseDto })
  catalog(
    @CurrentRequestContext() context: RequestContext,
    @Param("clientId") clientId: string,
  ): Promise<ServiceOnboardingCatalogResponseDto> {
    return this.service.getCatalog(context, clientId);
  }

  @Get(":clientId/service-onboarding/assignees")
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return employees ranked for a client's selected service." })
  @ApiOkResponse({ type: ServiceOnboardingAssigneesResponseDto })
  assignees(
    @CurrentRequestContext() context: RequestContext,
    @Param("clientId") clientId: string,
    @Query(new ZodValidationPipe(serviceOnboardingAssigneesQuerySchema)) query: ServiceOnboardingAssigneesQuery,
  ): Promise<ServiceOnboardingAssigneesResponseDto> {
    return this.service.listAssignees(context, clientId, query.serviceId);
  }

  @Post(":clientId/service-onboarding/activate")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Activate selected services, snapshot customization, and generate existing tasks." })
  @ApiOkResponse({ type: ActivateClientServicesResponseDto })
  activate(
    @CurrentRequestContext() context: RequestContext,
    @Param("clientId") clientId: string,
    @Body(new ZodValidationPipe(activateClientServicesSchema)) body: ActivateClientServicesRequest,
  ): Promise<ActivateClientServicesResponseDto> {
    return this.service.activate(context, clientId, body);
  }
}
