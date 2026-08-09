import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  notificationStatuses,
  NotificationsResponseDto,
  SuperAdminNotificationsQuery,
  superAdminNotificationsQuerySchema,
} from "./super-admin-notifications.dto";
import { ClientPortalNotificationsService } from "./client-portal-notifications.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/notifications")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalNotificationsController {
  constructor(
    @Inject(ClientPortalNotificationsService)
    private readonly service: ClientPortalNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Return notifications for the logged-in client account." })
  @ApiQuery({ name: "status", required: false, enum: notificationStatuses })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: NotificationsResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(superAdminNotificationsQuerySchema))
    query: SuperAdminNotificationsQuery,
  ): Promise<NotificationsResponseDto> {
    return this.service.list(context, query);
  }
}
