import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { TenantAdminDashboardResponseDto, TenantProfileDto, updateTenantProfileSchema, UpdateTenantProfileRequest } from "./tenant-admin-dashboard.dto";
import { TenantAdminDashboardService } from "./tenant-admin-dashboard.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/dashboard")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminDashboardController {
  constructor(
    @Inject(TenantAdminDashboardService)
    private readonly service: TenantAdminDashboardService,
  ) {}

  @Get()
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "Read tenant-scoped operational overview dashboard data for the authenticated Tenant Admin." })
  @ApiOkResponse({ type: TenantAdminDashboardResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  getDashboard(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminDashboardResponseDto> {
    return this.service.getDashboard(context);
  }

  @Get("profile")
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "Read the active tenant profile." })
  @ApiOkResponse({ type: TenantProfileDto })
  getTenantProfile(@CurrentRequestContext() context: RequestContext): Promise<TenantProfileDto> {
    return this.service.getTenantProfile(context);
  }

  @Patch("profile")
  @RequirePermissions("tenant.update")
  @ApiOperation({ summary: "Update the active tenant profile." })
  @ApiOkResponse({ type: TenantProfileDto })
  updateTenantProfile(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(updateTenantProfileSchema)) body: UpdateTenantProfileRequest,
  ): Promise<TenantProfileDto> {
    return this.service.updateTenantProfile(context, body);
  }
}
