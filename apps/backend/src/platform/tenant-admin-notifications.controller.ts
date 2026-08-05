import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  notificationStatuses,
  NotificationsResponseDto,
  SuperAdminNotificationsQuery,
  superAdminNotificationsQuerySchema,
  UnreadCountResponseDto,
} from "./super-admin-notifications.dto";
import { TenantAdminNotificationsService } from "./tenant-admin-notifications.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/notifications")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("tenant.read")
export class TenantAdminNotificationsController {
  constructor(
    @Inject(TenantAdminNotificationsService)
    private readonly service: TenantAdminNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Return recent notifications for the logged-in Tenant Admin." })
  @ApiQuery({ name: "status", required: false, enum: notificationStatuses })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: NotificationsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(superAdminNotificationsQuerySchema))
    query: SuperAdminNotificationsQuery,
  ): Promise<NotificationsResponseDto> {
    return this.service.list(context, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Return unread notification count for the logged-in Tenant Admin." })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async unreadCount(@CurrentRequestContext() context: RequestContext): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.service.unreadCount(context) };
  }

  @Patch(":notificationId/read")
  @HttpCode(204)
  @ApiOperation({ summary: "Mark one notification as read for the logged-in Tenant Admin." })
  @ApiNoContentResponse()
  async markRead(
    @CurrentRequestContext() context: RequestContext,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    await this.service.markRead(context, notificationId);
  }

  @Patch("read-all")
  @HttpCode(204)
  @ApiOperation({ summary: "Mark all notifications as read for the logged-in Tenant Admin." })
  @ApiNoContentResponse()
  async markAllRead(@CurrentRequestContext() context: RequestContext): Promise<void> {
    await this.service.markAllRead(context);
  }
}
