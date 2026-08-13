import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
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
  superAdminSearchQuerySchema,
  superAdminSearchScopes,
  SuperAdminSearchQuery,
  SuperAdminSearchResponseDto,
} from "./super-admin-search.dto";
import { SuperAdminSearchService } from "./super-admin-search.service";

@ApiTags("Super Admin")
@ApiBearerAuth()
@Controller("super-admin")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class SuperAdminSearchController {
  constructor(
    @Inject(SuperAdminSearchService)
    private readonly service: SuperAdminSearchService,
  ) {}

  @Get("search")
  @RequirePermissions("tenant.read")
  @ApiOperation({
    summary: "Search platform records for the Super Admin command palette.",
    description:
      "The actor is resolved from the Supabase bearer token. Query text is a lookup input only and never carries tenant, role, or actor authority.",
  })
  @ApiQuery({ name: "q", required: false, type: String, example: "northstar" })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiQuery({ name: "scope", required: false, enum: superAdminSearchScopes })
  @ApiOkResponse({ type: SuperAdminSearchResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  search(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(superAdminSearchQuerySchema))
    query: SuperAdminSearchQuery,
  ): Promise<SuperAdminSearchResponseDto> {
    return this.service.search(context, query);
  }
}
