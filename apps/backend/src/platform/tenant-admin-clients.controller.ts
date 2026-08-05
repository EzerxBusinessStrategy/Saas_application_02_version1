import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  tenantAdminClientsQuerySchema,
  tenantAdminContactInputSchema,
  tenantAdminContactUpdateSchema,
  TenantAdminClientContactDto,
  TenantAdminClientDetailDto,
  TenantAdminClientsQuery,
  TenantAdminClientsResponseDto,
  TenantAdminContactInput,
} from "./tenant-admin-clients.dto";
import { TenantAdminClientsService } from "./tenant-admin-clients.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/clients")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminClientsController {
  constructor(@Inject(TenantAdminClientsService) private readonly service: TenantAdminClientsService) {}

  @Get()
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return tenant-scoped clients with financial metrics." })
  @ApiOkResponse({ type: TenantAdminClientsResponseDto })
  list(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(tenantAdminClientsQuerySchema)) query: TenantAdminClientsQuery,
  ): Promise<TenantAdminClientsResponseDto> {
    return this.service.list(context, query);
  }

  @Get(":clientRef")
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return a tenant-scoped client detail record." })
  @ApiOkResponse({ type: TenantAdminClientDetailDto })
  detail(@CurrentRequestContext() context: RequestContext, @Param("clientRef") clientRef: string): Promise<TenantAdminClientDetailDto> {
    return this.service.detail(context, clientRef);
  }

  @Post(":clientRef/contacts")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Create a tenant-scoped client contact." })
  @ApiOkResponse({ type: TenantAdminClientContactDto })
  createContact(
    @CurrentRequestContext() context: RequestContext,
    @Param("clientRef") clientRef: string,
    @Body(new ZodValidationPipe(tenantAdminContactInputSchema)) body: TenantAdminContactInput,
  ): Promise<TenantAdminClientContactDto> {
    return this.service.createContact(context, clientRef, body);
  }

  @Patch(":clientRef/contacts/:contactId")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Update or archive a tenant-scoped client contact." })
  @ApiOkResponse({ type: TenantAdminClientContactDto })
  updateContact(
    @CurrentRequestContext() context: RequestContext,
    @Param("clientRef") clientRef: string,
    @Param("contactId") contactId: string,
    @Body(new ZodValidationPipe(tenantAdminContactUpdateSchema)) body: TenantAdminContactInput,
  ): Promise<TenantAdminClientContactDto> {
    return this.service.updateContact(context, clientRef, contactId, body);
  }
}
