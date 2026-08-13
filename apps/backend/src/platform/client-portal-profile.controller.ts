import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  ClientPortalProfileDto,
  UpdateClientPortalProfile,
  updateClientPortalProfileSchema,
} from "./client-portal-profile.dto";
import { ClientPortalProfileService } from "./client-portal-profile.service";

@ApiTags("Client Portal")
@ApiBearerAuth()
@Controller("client-portal/profile")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
@RequirePermissions("client.read.assigned")
export class ClientPortalProfileController {
  constructor(
    @Inject(ClientPortalProfileService)
    private readonly service: ClientPortalProfileService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Return profile preferences for the logged-in client account." })
  @ApiOkResponse({ type: ClientPortalProfileDto })
  read(@CurrentRequestContext() context: RequestContext): Promise<ClientPortalProfileDto> {
    return this.service.read(context);
  }

  @Patch()
  @ApiOperation({ summary: "Update profile preferences for the logged-in client account." })
  @ApiOkResponse({ type: ClientPortalProfileDto })
  update(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(updateClientPortalProfileSchema)) body: UpdateClientPortalProfile,
  ): Promise<ClientPortalProfileDto> {
    return this.service.update(context, body);
  }
}
