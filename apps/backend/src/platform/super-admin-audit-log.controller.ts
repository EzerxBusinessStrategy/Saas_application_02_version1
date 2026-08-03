import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { AuditLogQuery, AuditLogResponseDto, auditLogQuerySchema } from "./super-admin-audit-log.dto";
import { SuperAdminAuditLogService } from "./super-admin-audit-log.service";

@ApiTags("Super Admin")
@ApiBearerAuth()
@Controller("super-admin/audit-log")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
export class SuperAdminAuditLogController {
  constructor(
    @Inject(SuperAdminAuditLogService)
    private readonly service: SuperAdminAuditLogService,
  ) {}

  @Get()
  @RequirePermissions("audit_log.read")
  @ApiOperation({ summary: "List real platform audit events." })
  @ApiOkResponse({ type: AuditLogResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery,
  ): Promise<AuditLogResponseDto> {
    return this.service.list(context, query);
  }
}
