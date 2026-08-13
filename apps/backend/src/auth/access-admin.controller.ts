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
  EmailAvailabilityResponseDto,
  InvitationResponseDto,
  TenantCreationOptionsResponseDto,
  TenantStatusResponseDto,
  UpdateTenantStatusDto,
  UpdateTenantStatusRequest,
  updateTenantStatusSchema,
  ReactivateMembershipDto,
  reactivateMembershipSchema,
  RevokeMembershipDto,
  revokeMembershipSchema,
  MembershipAccessResponseDto,
  ResetTenantAdministratorPasswordDto,
  resetTenantAdministratorPasswordSchema,
  TenantAdministratorPasswordResetResponseDto,
} from "./access-admin.dto";
import { AccessAdminService } from "./access-admin.service";
import { ActiveRequestContextGuard } from "./guards/active-request-context.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { PortalSessionGuard } from "./guards/portal-session.guard";
import { RequirePermissions } from "./permissions.decorator";
import { CurrentRequestContext } from "./request-context.decorator";
import { AuthenticatedRequest, RequestContext } from "./request-context";

@ApiTags("Access administration")
@ApiBearerAuth()
@Controller()
export class AccessAdminController {
  constructor(@Inject(AccessAdminService) private readonly service: AccessAdminService) {}

  @Get("super-admin/tenant-creation-options")
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
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
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "List platform tenants for the Super Admin tenant directory." })
  @ApiOkResponse()
  listTenants(
    @CurrentRequestContext() context: RequestContext,
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("createdAfter") createdAfter?: string,
    @Query("countryCode") countryCode?: string,
    @Query("financialYear") financialYear?: string,
    @Query("sort") sort?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.listTenants(context, {
      query,
      status,
      createdAfter,
      countryCode,
      financialYear,
      sort,
      page: Number(page ?? "1"),
      pageSize: Number(pageSize ?? "10"),
    });
  }

  @Get("super-admin/users/email-availability")
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.create")
  @ApiOperation({ summary: "Check whether a Tenant Administrator email is available." })
  @ApiOkResponse({ type: EmailAvailabilityResponseDto })
  getEmailAvailability(
    @CurrentRequestContext() context: RequestContext,
    @Query("email") email: string,
  ): Promise<EmailAvailabilityResponseDto> {
    return this.service.getEmailAvailability(context, email);
  }

  @Get("super-admin/tenant-list-filters")
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "List database-backed country and financial-year filters for the tenant directory." })
  @ApiOkResponse()
  listTenantFilters(@CurrentRequestContext() context: RequestContext) {
    return this.service.listTenantFilters(context);
  }

  @Get("super-admin/tenants/:tenantId")
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
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
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.read")
  @ApiOperation({ summary: "Suspend, reactivate, or permanently revoke a tenant workspace without deleting its data." })
  @ApiBody({ type: UpdateTenantStatusDto })
  @ApiOkResponse({ type: TenantStatusResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  updateTenantStatus(
    @CurrentRequestContext() context: RequestContext,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(updateTenantStatusSchema)) body: UpdateTenantStatusRequest,
  ) {
    return this.service.updateTenantStatus(context, tenantId, body.status, body.suspensionDuration, body.reason);
  }

  @Post("super-admin/tenants/:tenantId/password")
  @HttpCode(200)
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.update")
  @ApiOperation({ summary: "Set a new password for the active Tenant Administrator." })
  @ApiBody({ type: ResetTenantAdministratorPasswordDto })
  @ApiOkResponse({ type: TenantAdministratorPasswordResetResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  resetTenantAdministratorPassword(
    @CurrentRequestContext() context: RequestContext,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(resetTenantAdministratorPasswordSchema)) body: ResetTenantAdministratorPasswordDto,
  ): Promise<TenantAdministratorPasswordResetResponseDto> {
    return this.service.resetTenantAdministratorPassword(context, tenantId, body);
  }

  @Post("super-admin/tenants")
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
  @RequirePermissions("tenant.create")
  @ApiOperation({
    summary: "Create an active tenant, financial year and Tenant Administrator account.",
    description:
      "Only a Super Admin can create a tenant. The administrator password is stored as an Argon2id hash in the tenant credential namespace; no invitation email is created.",
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
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
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
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
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
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
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
  @UseGuards(PortalSessionGuard)
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
      throw new Error("Verified auth user was not attached by PortalSessionGuard.");
    }
    return this.service.acceptInvitation(request.verifiedAuthUser, invitationId, body.displayName);
  }

  @Post("memberships/:membershipId/revoke")
  @HttpCode(200)
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
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
  @UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
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
