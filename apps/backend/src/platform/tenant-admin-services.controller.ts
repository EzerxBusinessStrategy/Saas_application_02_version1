import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  tenantAdminServiceCreateSchema,
  TenantAdminServiceCreateRequest,
  TenantAdminServiceDto,
  TenantAdminServicesResponseDto,
} from "./tenant-admin-services.dto";
import { TenantAdminServicesService } from "./tenant-admin-services.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/services")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminServicesController {
  constructor(
    @Inject(TenantAdminServicesService)
    private readonly service: TenantAdminServicesService,
  ) {}

  @Get()
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return tenant-scoped services with active rate-card items." })
  @ApiOkResponse({ type: TenantAdminServicesResponseDto })
  list(@CurrentRequestContext() context: RequestContext): Promise<TenantAdminServicesResponseDto> {
    return this.service.list(context);
  }

  @Post()
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Create a tenant-scoped service with a reusable default rate." })
  @ApiOkResponse({ type: TenantAdminServiceDto })
  create(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(tenantAdminServiceCreateSchema)) body: TenantAdminServiceCreateRequest,
  ): Promise<TenantAdminServiceDto> {
    return this.service.create(context, body);
  }
}

