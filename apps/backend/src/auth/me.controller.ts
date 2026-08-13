import { Body, Controller, Get, HttpCode, Inject, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBody,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { ActiveRequestContextGuard } from "./guards/active-request-context.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { PortalSessionGuard } from "./guards/portal-session.guard";
import {
  MeResponseDto,
  UpdateMyPreferencesDto,
  UpdateMyProfileDto,
  UserPreferencesDto,
  updateMyPreferencesSchema,
  updateMyProfileSchema,
} from "./me.dto";
import { MeService } from "./me.service";
import { CurrentRequestContext } from "./request-context.decorator";
import { RequestContext } from "./request-context";

@ApiTags("Identity")
@ApiBearerAuth()
@Controller("me")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  @ApiOperation({
    summary: "Return the verified application user and active tenant membership.",
    description:
      "The portal session cookie is verified against the authentication database. Portal, tenant, and role inputs are verified against backend membership data.",
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto, description: "Missing, malformed, expired, or invalid token." })
  @ApiForbiddenResponse({
    type: ApiErrorResponseDto,
    description: "Inactive user, tenant, membership, forbidden portal, or unassigned role.",
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto, description: "Multiple active memberships require tenant selection." })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto, description: "Auth or database configuration is missing." })
  getMe(@CurrentRequestContext() context: RequestContext): Promise<MeResponseDto> {
    return this.meService.getMe(context);
  }

  @Patch("profile")
  @HttpCode(200)
  @ApiOperation({ summary: "Update the current platform administrator profile." })
  @ApiBody({ type: UpdateMyProfileDto })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  updateProfile(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(updateMyProfileSchema)) body: UpdateMyProfileDto,
  ): Promise<MeResponseDto> {
    return this.meService.updateProfile(context, body.displayName);
  }

  @Patch("preferences")
  @HttpCode(200)
  @ApiOperation({ summary: "Update the verified user's locale and time-zone preferences." })
  @ApiBody({ type: UpdateMyPreferencesDto })
  @ApiOkResponse({ type: UserPreferencesDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  updatePreferences(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(updateMyPreferencesSchema)) body: UpdateMyPreferencesDto,
  ): Promise<{ preferences: UserPreferencesDto }> {
    return this.meService.updatePreferences(context, body);
  }
}
