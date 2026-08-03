import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  AcceptInvitationDto,
  acceptInvitationSchema,
  AcceptedInvitationResponseDto,
  CloseInvitationDto,
  closeInvitationSchema,
  ClosedInvitationResponseDto,
  CreateInvitationDto,
  createInvitationSchema,
  CreateTenantWithOwnerInvitationDto,
  createTenantWithOwnerInvitationSchema,
  CreateTenantWithOwnerInvitationResponseDto,
  InvitationResponseDto,
  TenantCreationOptionsResponseDto,
  TenantStatusResponseDto,
  UpdateTenantStatusRequest,
  updateTenantStatusSchema,
  ReactivateMembershipDto,
  reactivateMembershipSchema,
  RevokeMembershipDto,
  revokeMembershipSchema,
  MembershipAccessResponseDto,
} from "./access-admin.dto";
import { AccessAdminService } from "./access-admin.service";
import { ActiveRequestContextGuard } from "./guards/active-request-context.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { RequirePermissions } from "./permissions.decorator";
import { CurrentRequestContext } from "./request-context.decorator";
import { AuthenticatedRequest, RequestContext } from "./request-context";

@ApiTags("Access administration")
@ApiBearerAuth()
@Controller()
export class AccessAdminController {
  constructor(@Inject(AccessAdminService) private readonly service: AccessAdminService) {}

  @Get("super-admin/tenant-creation-options")
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.create")
  @ApiOperation({ summary: "Return supported tenant creation country and financial-year options." })
  @ApiOkResponse({ type: TenantCreationOptionsResponseDto })
  getTenantCreationOptions(
    @CurrentRequestContext() context: RequestContext,
    @Query("countryCode") countryCode?: string,
    @Query("incorporationDate") incorporationDate?: string,
  ): Promise<TenantCreationOptionsResponseDto> {
    return this.service.getTenantCreationOptions(context, countryCode, incorporationDate);
  }

  @Get("super-admin/tenants")
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "List platform tenants for the Super Admin tenant directory." })
  @ApiOkResponse()
  listTenants(
    @CurrentRequestContext() context: RequestContext,
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("createdAfter") createdAfter?: string,
    @Query("sort") sort?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.listTenants(context, {
      query,
      status,
      createdAfter,
      sort,
      page: Number(page ?? "1"),
      pageSize: Number(pageSize ?? "10"),
    });
  }

  @Get("super-admin/tenants/:tenantId")
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "Get one platform tenant record." })
  @ApiOkResponse()
  getTenant(
    @CurrentRequestContext() context: RequestContext,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
  ) {
    return this.service.getTenant(context, tenantId);
  }

  @Patch("super-admin/tenants/:tenantId/status")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.suspend")
  @ApiOperation({ summary: "Suspend or reactivate a tenant and enforce workspace access state." })
  @ApiBody({ type: TenantStatusResponseDto })
  @ApiOkResponse({ type: TenantStatusResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  updateTenantStatus(
    @CurrentRequestContext() context: RequestContext,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(updateTenantStatusSchema)) body: UpdateTenantStatusRequest,
  ) {
    return this.service.updateTenantStatus(context, tenantId, body.status, body.reason);
  }

  @Post("super-admin/tenants/:tenantId/invitation/cancel")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("invitation.cancel")
  @ApiOperation({ summary: "Cancel the pending Tenant Administrator invitation for a tenant." })
  @ApiBody({ type: CloseInvitationDto })
  @ApiOkResponse({ type: ClosedInvitationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  cancelTenantAdminInvitation(
    @CurrentRequestContext() context: RequestContext,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(closeInvitationSchema)) body: CloseInvitationDto,
  ): Promise<ClosedInvitationResponseDto> {
    return this.service.cancelTenantAdminInvitation(context, tenantId, body.reason);
  }

  @Post("super-admin/tenants")
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.create")
  @ApiOperation({
    summary: "Create a pending tenant, financial year and Tenant Admin invitation.",
    description:
      "Only a Super Admin can create a tenant. The administrator receives a Supabase invitation email when delivery is configured; no password is created or returned.",
  })
  @ApiBody({ type: CreateTenantWithOwnerInvitationDto })
  @ApiCreatedResponse({ type: CreateTenantWithOwnerInvitationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createTenantWithOwnerInvitation(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTenantWithOwnerInvitationSchema))
    body: CreateTenantWithOwnerInvitationDto,
  ): Promise<CreateTenantWithOwnerInvitationResponseDto> {
    return this.service.createTenantWithOwnerInvitation(context, body);
  }

  @Post("invitations")
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("invitation.create")
  @ApiOperation({
    summary: "Create a tenant-scoped invitation for a predefined role.",
    description:
      "The actor and tenant are derived from the verified request context. The invitee cannot choose their role.",
  })
  @ApiBody({ type: CreateInvitationDto })
  @ApiCreatedResponse({ type: InvitationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createInvitation(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createInvitationSchema)) body: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    return this.service.createInvitation(context, body);
  }

  @Post("invitations/:invitationId/cancel")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("invitation.cancel")
  @ApiOperation({ summary: "Cancel a pending invitation before it is accepted." })
  @ApiBody({ type: CloseInvitationDto })
  @ApiOkResponse({ type: ClosedInvitationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  cancelInvitation(
    @CurrentRequestContext() context: RequestContext,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
    @Body(new ZodValidationPipe(closeInvitationSchema)) body: CloseInvitationDto,
  ): Promise<ClosedInvitationResponseDto> {
    return this.service.cancelInvitation(context, invitationId, body.reason);
  }

  @Post("invitations/:invitationId/revoke")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("invitation.revoke")
  @ApiOperation({ summary: "Revoke a pending invitation." })
  @ApiBody({ type: CloseInvitationDto })
  @ApiOkResponse({ type: ClosedInvitationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  revokeInvitation(
    @CurrentRequestContext() context: RequestContext,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
    @Body(new ZodValidationPipe(closeInvitationSchema)) body: CloseInvitationDto,
  ): Promise<ClosedInvitationResponseDto> {
    return this.service.revokeInvitation(context, invitationId, body.reason);
  }

  @Post("invitations/:invitationId/accept")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: "Accept an invitation with the authenticated Supabase identity.",
    description:
      "The verified Supabase email must match the invitation email. The backend creates or activates the application user, tenant membership, and intended role.",
  })
  @ApiBody({ type: AcceptInvitationDto })
  @ApiOkResponse({ type: AcceptedInvitationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  acceptInvitation(
    @Req() request: FastifyRequest & AuthenticatedRequest,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationDto,
  ): Promise<AcceptedInvitationResponseDto> {
    if (!request.verifiedAuthUser) {
      throw new Error("Verified auth user was not attached by SupabaseAuthGuard.");
    }
    return this.service.acceptInvitation(request.verifiedAuthUser, invitationId, body.displayName);
  }

  @Post("memberships/:membershipId/revoke")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("membership.revoke")
  @ApiOperation({
    summary: "Revoke tenant membership access without deleting historical records.",
  })
  @ApiBody({ type: RevokeMembershipDto })
  @ApiOkResponse({ type: MembershipAccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  revokeMembership(
    @CurrentRequestContext() context: RequestContext,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @Body(new ZodValidationPipe(revokeMembershipSchema)) body: RevokeMembershipDto,
  ): Promise<MembershipAccessResponseDto> {
    return this.service.revokeMembership(context, membershipId, body);
  }

  @Post("memberships/:membershipId/reactivate")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("membership.reactivate")
  @ApiOperation({
    summary: "Reactivate a revoked tenant membership with one reviewed role.",
  })
  @ApiBody({ type: ReactivateMembershipDto })
  @ApiOkResponse({ type: MembershipAccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  reactivateMembership(
    @CurrentRequestContext() context: RequestContext,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @Body(new ZodValidationPipe(reactivateMembershipSchema)) body: ReactivateMembershipDto,
  ): Promise<MembershipAccessResponseDto> {
    return this.service.reactivateMembership(context, membershipId, body);
  }
}
