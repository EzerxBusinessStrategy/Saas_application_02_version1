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
import {
  PlatformConfigurationResponseDto,
  UpdatePlatformConfigurationRequest,
  updatePlatformConfigurationSchema,
} from "./super-admin-platform-configuration.dto";
import { SuperAdminPlatformConfigurationService } from "./super-admin-platform-configuration.service";

@ApiTags("Super Admin")
@ApiBearerAuth()
@Controller("super-admin/platform-configuration")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class SuperAdminPlatformConfigurationController {
  constructor(
    @Inject(SuperAdminPlatformConfigurationService)
    private readonly service: SuperAdminPlatformConfigurationService,
  ) {}

  @Get()
  @RequirePermissions("platform.configuration.read")
  @ApiOperation({ summary: "Read persistent global platform configuration." })
  @ApiOkResponse({ type: PlatformConfigurationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  get(@CurrentRequestContext() context: RequestContext): Promise<PlatformConfigurationResponseDto> {
    return this.service.get(context);
  }

  @Patch()
  @RequirePermissions("platform.configuration.update")
  @ApiOperation({ summary: "Persist global platform identity, brand colour, and email sender defaults." })
  @ApiOkResponse({ type: PlatformConfigurationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  update(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(updatePlatformConfigurationSchema)) request: UpdatePlatformConfigurationRequest,
  ): Promise<PlatformConfigurationResponseDto> {
    return this.service.update(context, request);
  }
}
