import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import {
  dashboardHealthFilters,
  dashboardPeriodModes,
  dashboardTenantStatusFilters,
  SuperAdminDashboardQuery,
  SuperAdminDashboardResponseDto,
  superAdminDashboardQuerySchema,
} from "./super-admin-dashboard.dto";
import { updateReviewSchema, UpdateReviewRequest } from "./super-admin-dashboard-actions.dto";
import { SuperAdminDashboardService } from "./super-admin-dashboard.service";

@ApiTags("Super Admin")
@ApiBearerAuth()
@Controller("super-admin")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class SuperAdminDashboardController {
  constructor(
    @Inject(SuperAdminDashboardService)
    private readonly service: SuperAdminDashboardService,
  ) {}

  @Get("dashboard")
  @RequirePermissions("report.read")
  @ApiOperation({
    summary: "Return one Super Admin dashboard data package.",
    description:
      "The actor is resolved from the Supabase bearer token. Filters are presentation inputs only; tenant, role and authority are never accepted from the browser.",
  })
  @ApiQuery({ name: "from", required: false, type: String, example: "2026-04-01" })
  @ApiQuery({ name: "to", required: false, type: String, example: "2027-03-31" })
  @ApiQuery({ name: "periodMode", required: false, enum: dashboardPeriodModes })
  @ApiQuery({ name: "financialYearId", required: false, type: String, example: "fy-2026-27" })
  @ApiQuery({ name: "health", required: false, enum: dashboardHealthFilters })
  @ApiQuery({ name: "tenantStatus", required: false, enum: dashboardTenantStatusFilters })
  @ApiQuery({ name: "country", required: false, type: String, example: "IN" })
  @ApiQuery({ name: "search", required: false, type: String, example: "ABC Technologies" })
  @ApiOkResponse({ type: SuperAdminDashboardResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  getDashboard(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(superAdminDashboardQuerySchema))
    query: SuperAdminDashboardQuery,
  ): Promise<SuperAdminDashboardResponseDto> {
    return this.service.getDashboard(context, query);
  }

  @Patch("alerts/:alertId/view")
  @HttpCode(204)
  @RequirePermissions("report.read")
  @ApiOperation({ summary: "Mark a platform alert as viewed." })
  @ApiParam({ name: "alertId", type: String })
  async viewAlert(
    @CurrentRequestContext() context: RequestContext,
    @Param("alertId") alertId: string,
  ): Promise<void> {
    await this.service.markAlertViewed(context, alertId);
  }

  @Post("alerts/:alertId/reviews")
  @HttpCode(204)
  @RequirePermissions("report.read")
  @ApiOperation({ summary: "Create a tenant review from a platform alert." })
  @ApiParam({ name: "alertId", type: String })
  async createReviewFromAlert(
    @CurrentRequestContext() context: RequestContext,
    @Param("alertId") alertId: string,
  ): Promise<void> {
    await this.service.createReviewFromAlert(context, alertId);
  }

  @Patch("tenant-reviews/:reviewId")
  @HttpCode(204)
  @RequirePermissions("report.read")
  @ApiOperation({ summary: "Update a tenant review lifecycle state." })
  @ApiParam({ name: "reviewId", type: String })
  async updateReview(
    @CurrentRequestContext() context: RequestContext,
    @Param("reviewId") reviewId: string,
    @Body(new ZodValidationPipe(updateReviewSchema)) body: UpdateReviewRequest,
  ): Promise<void> {
    await this.service.updateReview(context, reviewId, body);
  }
}
