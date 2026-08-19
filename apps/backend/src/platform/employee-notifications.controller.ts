import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  notificationStatuses,
  NotificationsResponseDto,
  SuperAdminNotificationsQuery,
  superAdminNotificationsQuerySchema,
  UnreadCountResponseDto,
} from "./super-admin-notifications.dto";
import { EmployeeNotificationsService } from "./employee-notifications.service";

@ApiTags("Employee")
@ApiBearerAuth()
@Controller("employee/notifications")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("task.read.assigned")
export class EmployeeNotificationsController {
  constructor(@Inject(EmployeeNotificationsService) private readonly service: EmployeeNotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Return notifications for the logged-in employee." })
  @ApiQuery({ name: "status", required: false, enum: notificationStatuses })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: NotificationsResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(superAdminNotificationsQuerySchema)) query: SuperAdminNotificationsQuery,
  ): Promise<NotificationsResponseDto> {
    return this.service.list(context, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Return unread notification count for the logged-in employee." })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async unreadCount(@CurrentRequestContext() context: RequestContext): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.service.unreadCount(context) };
  }

  @Patch("read-all")
  @HttpCode(204)
  @ApiOperation({ summary: "Mark all employee notifications as read." })
  @ApiNoContentResponse()
  async markAllRead(@CurrentRequestContext() context: RequestContext): Promise<void> {
    await this.service.markAllRead(context);
  }

  @Patch(":notificationId/read")
  @HttpCode(204)
  @ApiOperation({ summary: "Mark one employee notification as read." })
  @ApiNoContentResponse()
  async markRead(
    @CurrentRequestContext() context: RequestContext,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    await this.service.markRead(context, notificationId);
  }
}
