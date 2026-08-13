import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { TenantAnalyticsQuery, TenantAnalyticsResponseDto, tenantAnalyticsQuerySchema } from "./tenant-analytics.dto";
import { TenantAnalyticsService } from "./tenant-analytics.service";

@ApiTags("Super Admin")
@ApiBearerAuth()
@Controller("super-admin/tenant-analytics")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAnalyticsController {
  constructor(@Inject(TenantAnalyticsService) private readonly service: TenantAnalyticsService) {}

  @Get()
  @RequirePermissions("report.read")
  @ApiOperation({ summary: "Read tenant financial and operational analytics for a financial year or custom date range." })
  @ApiOkResponse({ type: TenantAnalyticsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  get(@CurrentRequestContext() context: RequestContext, @Query(new ZodValidationPipe(tenantAnalyticsQuerySchema)) query: TenantAnalyticsQuery): Promise<TenantAnalyticsResponseDto> {
    return this.service.get(context, query);
  }
}
