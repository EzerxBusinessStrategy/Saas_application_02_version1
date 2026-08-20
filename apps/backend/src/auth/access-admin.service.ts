import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AcceptedInvitationResponseDto,
  ClosedInvitationResponseDto,
  CreateInvitationRequest,
  CreateTenantWithOwnerInvitationRequest,
  CreateTenantWithOwnerInvitationResponseDto,
  EmailAvailabilityResponseDto,
  TenantCreationOptionsResponseDto,
  MembershipAccessResponseDto,
  ReactivateMembershipRequest,
  ResetTenantAdministratorPasswordRequest,
  TenantAdministratorPasswordResetResponseDto,
  RevokeMembershipRequest,
  TenantRoleCode,
} from "./access-admin.dto";
import { AccessAdminRepository } from "./access-admin.repository";
import { parseFinancialYearDate, suggestFinancialYear } from "../platform/financial-year-policy";
import {
  invitationRoleNotAllowed,
  permissionDenied,
  verifiedInviteEmailRequired,
} from "./auth-errors";
import { RequestContext, VerifiedAuthUser } from "./request-context";
import { PasswordService } from "./core/password.service";

const ownerInviteRoles = [
  "TENANT_ADMIN",
  "FINANCE_USER",
  "HR_OPERATIONS_USER",
  "MANAGER",
  "EMPLOYEE",
  "CLIENT_USER",
] as const;

const adminInviteRoles = [
  "FINANCE_USER",
  "HR_OPERATIONS_USER",
  "MANAGER",
  "EMPLOYEE",
  "CLIENT_USER",
] as const;

@Injectable()
export class AccessAdminService {
  constructor(
    @Inject(AccessAdminRepository) private readonly repository: AccessAdminRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService = new PasswordService(),
  ) { }

  async createTenantWithOwnerInvitation(
    context: RequestContext,
    request: CreateTenantWithOwnerInvitationRequest,
  ): Promise<CreateTenantWithOwnerInvitationResponseDto> {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.create")) {
      throw permissionDenied();
    }
    await this.validateTenantCreation(context, request);
    const administratorMode = request.administratorMode ?? "another_person";
    if (administratorMode === "myself") {
      const created = await this.createSelfAccessTenantOrThrowConflict(context, request);
      return {
        tenantId: created.tenant_id,
        financialYearId: created.financial_year_id,
        membershipId: created.membership_id,
        tenantStatus: "active" as const,
      };
    }
    if (!request.tenantAdministrator) {
      throw new BadRequestException({
        code: "TENANT_ADMINISTRATOR_REQUIRED",
        message: "Enter the Tenant Administrator details.",
      });
    }
    const normalizedEmail = normalizeEmail(request.tenantAdministrator.email);
    if (await this.isTenantAdminEmailTaken(context, normalizedEmail)) throw emailAlreadyExists();
    const passwordHash = await this.passwords.hash(request.tenantAdministrator.password);
    const created = await this.createTenantOrThrowConflict(context, {
      ...request,
      tenantAdministrator: { ...request.tenantAdministrator, email: normalizedEmail },
    }, passwordHash);
    return { tenantId: created.tenant_id, financialYearId: created.financial_year_id, membershipId: created.membership_id, tenantStatus: "active" as const };
  }

  async getEmailAvailability(context: RequestContext, email: string): Promise<EmailAvailabilityResponseDto> {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.create")) {
      throw permissionDenied();
    }
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new BadRequestException({ code: "INVALID_EMAIL", message: "Enter a valid email address." });
    }
    const exists = await this.isTenantAdminEmailTaken(context, normalizedEmail);
    return exists ? { available: false, reason: "EMAIL_ALREADY_EXISTS" } : { available: true };
  }

  private async validateTenantCreation(
    context: RequestContext,
    request: CreateTenantWithOwnerInvitationRequest,
  ): Promise<void> {
    const templates = await this.repository.listTenantCreationTemplates(context);
    const countryTemplate = templates.find((item) => item.country_code === request.company.countryCode);

    if (countryTemplate?.policy_mode === "INCORPORATION_DERIVED" && !request.company.incorporationDate) {
      throw new BadRequestException({
        code: "INCORPORATION_DATE_REQUIRED",
        message: "Enter the incorporation date for this United Kingdom company.",
      });
    }

    // Template validation: required when using country suggestion, optional for custom
    let template: (typeof templates)[number] | undefined;
    if (request.financialYear.templateId) {
      template = templates.find((item) => item.id === request.financialYear.templateId);
      if (!template) {
        throw new BadRequestException({
          code: "FINANCIAL_YEAR_TEMPLATE_NOT_FOUND",
          message: "The selected financial-year policy was not found.",
        });
      }
      if (template.country_code !== request.company.countryCode) {
        throw new BadRequestException({
          code: "FINANCIAL_YEAR_TEMPLATE_COUNTRY_MISMATCH",
          message: "Financial-year policy does not match the selected country.",
        });
      }
    }

    // Custom financial year validation
    if (request.financialYear.source === "CUSTOM_CONFIRMED") {
      if (!request.financialYear.overrideReason?.trim()) {
        throw new BadRequestException({
          code: "CUSTOM_FINANCIAL_YEAR_REASON_REQUIRED",
          message: "Custom financial year requires an override reason.",
        });
      }
      // For custom FY, find the country template just for validation limits
      if (!template) {
        template = templates.find((item) => item.country_code === request.company.countryCode);
      }
    }

    // Date validation
    let start: Date;
    let end: Date;
    try {
      start = parseFinancialYearDate(request.financialYear.startsOn);
      end = parseFinancialYearDate(request.financialYear.endsOn);
    } catch {
      throw new BadRequestException({ code: "INVALID_DATE", message: "Date is invalid." });
    }
    if (start >= end) {
      throw new BadRequestException({
        code: "INVALID_FINANCIAL_YEAR_DATES",
        message: "Financial year start date must be before end date.",
      });
    }

    // Period length validation (if template defines a limit)
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (template?.maximum_period_days && days > template.maximum_period_days) {
      throw new BadRequestException({
        code: "FINANCIAL_YEAR_TOO_LONG",
        message: `Financial-year period exceeds the ${template.maximum_period_days}-day limit for ${template.country_code}.`,
      });
    }
  }

  private async createSelfAccessTenantOrThrowConflict(
    context: RequestContext,
    request: CreateTenantWithOwnerInvitationRequest,
  ) {
    try {
      return await this.repository.createTenantForCurrentUser(context, request);
    } catch (error) {
      if (isPgUniqueError(error)) {
        throw new ConflictException({
          code: "TENANT_CREATE_CONFLICT",
          message: "Tenant code, slug, or pending administrator invitation already exists.",
        });
      }
      if (isPgCheckError(error)) {
        throw new BadRequestException({
          code: "TENANT_CREATE_INVALID",
          message: "Tenant creation details are invalid.",
        });
      }
      throw error;
    }
  }

  private async createTenantOrThrowConflict(
    context: RequestContext,
    request: CreateTenantWithOwnerInvitationRequest,
    passwordHash: string,
  ) {
    try {
      return await this.repository.createTenantWithDirectTenantAdministrator(context, request, passwordHash);
    } catch (error) {
      if (isTenantAdminEmailConflict(error)) {
        throw emailAlreadyExists();
      }
      if (isPgUniqueError(error)) {
        throw new ConflictException({
          code: "TENANT_CREATE_CONFLICT",
          message: "Tenant code, slug, or pending administrator invitation already exists.",
        });
      }
      if (isPgCheckError(error)) {
        throw new BadRequestException({
          code: "TENANT_CREATE_INVALID",
          message: "Tenant creation details are invalid.",
        });
      }
      // Surface the actual database error message in development so it is visible
      const pgMessage = (error as Record<string, unknown>)?.message;
      const pgDetail = (error as Record<string, unknown>)?.detail;
      const pgHint = (error as Record<string, unknown>)?.hint;
      const pgCode = (error as Record<string, unknown>)?.code;
      console.error("[createTenant] Unhandled DB error:", { pgCode, pgMessage, pgDetail, pgHint, error });
      throw error;
    }
  }

  private async isTenantAdminEmailTaken(context: RequestContext, normalizedEmail: string): Promise<boolean> {
    return this.repository.userEmailExists(context, normalizedEmail);
  }

  async getTenantCreationOptions(
    context: RequestContext,
    countryCode?: string,
    incorporationDate?: string,
  ): Promise<TenantCreationOptionsResponseDto> {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.create")) {
      throw permissionDenied();
    }
    const templates = await this.repository.listTenantCreationTemplates(context);
    const countries = templates.map((template) => ({
      countryCode: template.country_code,
      name: countryName(template.country_code),
      reportingCurrencyCode: template.metadata.defaultCurrency ?? "USD",
      timezone: template.metadata.defaultTimezone ?? "UTC",
    }));
    const selected = countryCode
      ? templates.find((template) => template.country_code === countryCode.toUpperCase())
      : undefined;
    if (!selected) return { countries };

    const suggested = suggestFinancialYear({
      policyMode: selected.policy_mode,
      startMonth: selected.start_month,
      startDay: selected.start_day,
      endMonth: selected.end_month,
      endDay: selected.end_day,
    }, incorporationDate);
    return {
      countries,
      countryCode: selected.country_code,
      policyMode: selected.policy_mode,
      suggestedFinancialYear: suggested
        ? {
          id: selected.id,
          label: suggested.label,
          startsOn: suggested.startsOn,
          endsOn: suggested.endsOn,
          source: "COUNTRY_SUGGESTION",
        }
        : undefined,
      suggestedYearEnds: selected.metadata.suggestedYearEnds,
      confirmationRequired: selected.confirmation_required,
      customAllowed: selected.custom_allowed,
      guidance: selected.metadata.guidance,
    };
  }

  async listTenants(
    context: RequestContext,
    request: {
      readonly query?: string;
      readonly status?: string;
      readonly createdAfter?: string;
      readonly countryCode?: string;
      readonly financialYear?: string;
      readonly sort?: string;
      readonly page?: number;
      readonly pageSize?: number;
    },
  ) {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.read")) {
      throw permissionDenied();
    }
    const pageInput = Number.isFinite(request.page) ? request.page : 1;
    const pageSizeInput = Number.isFinite(request.pageSize) ? request.pageSize : 10;
    const page = Math.max(1, pageInput ?? 1);
    const pageSize = Math.min(100, Math.max(1, pageSizeInput ?? 10));
    const rows = await this.repository.listTenants(context, { ...request, page, pageSize });
    const totalItems = Number(rows[0]?.total_items ?? 0);
    return {
      items: rows.map(mapTenantRow),
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(totalItems / pageSize)),
      totalItems,
    };
  }

  async listTenantFilters(context: RequestContext) {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.read")) {
      throw permissionDenied();
    }
    const rows = await this.repository.listTenantFilters(context);
    return {
      countries: [...new Set(rows.map((row) => row.country_code))],
      financialYears: rows
        .filter((row): row is typeof row & { financial_year_label: string } => Boolean(row.financial_year_label))
        .map((row) => ({ countryCode: row.country_code, label: row.financial_year_label })),
    };
  }

  async getTenant(context: RequestContext, tenantId: string) {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.read")) {
      throw permissionDenied();
    }
    const row = await this.repository.getTenant(context, tenantId);
    if (!row) {
      throw new NotFoundException({ code: "TENANT_NOT_FOUND", message: "Tenant was not found." });
    }
    return mapTenantRow(row);
  }

  async createInvitation(
    context: RequestContext,
    request: CreateInvitationRequest,
  ): Promise<{
    readonly id: string;
    readonly email: string;
    readonly roleCode: TenantRoleCode;
    readonly status: string;
    readonly expiresAt: string;
  }> {
    assertCanAssignRole(context, request.roleCode);
    const created = await this.repository.createInvitation(context, request);
    return {
      id: created.invitation_id,
      email: request.email,
      roleCode: created.role_code as TenantRoleCode,
      status: created.status,
      expiresAt: created.expires_at.toISOString(),
    };
  }

  async cancelInvitation(
    context: RequestContext,
    invitationId: string,
    reason?: string,
  ): Promise<ClosedInvitationResponseDto> {
    const closed = await this.repository.closeInvitation(context, invitationId, "cancelled", reason);
    return { invitationId: closed.invitation_id, status: closed.status };
  }

  async revokeInvitation(
    context: RequestContext,
    invitationId: string,
    reason?: string,
  ): Promise<ClosedInvitationResponseDto> {
    const closed = await this.repository.closeInvitation(context, invitationId, "revoked", reason);
    return { invitationId: closed.invitation_id, status: closed.status };
  }

  async acceptInvitation(
    verifiedUser: VerifiedAuthUser,
    invitationId: string,
    displayName?: string,
  ): Promise<AcceptedInvitationResponseDto> {
    if (!verifiedUser.email) throw verifiedInviteEmailRequired();
    const accepted = await this.repository.acceptInvitation(verifiedUser, invitationId, displayName);
    return {
      tenantId: accepted.tenant_id,
      userId: accepted.user_id,
      membershipId: accepted.membership_id,
      roleCode: accepted.role_code as TenantRoleCode,
      status: accepted.status,
    };
  }

  async revokeMembership(
    context: RequestContext,
    membershipId: string,
    request: RevokeMembershipRequest,
  ): Promise<MembershipAccessResponseDto> {
    const revoked = await this.repository.revokeMembership(context, membershipId, request.reason);
    return { membershipId: revoked.membership_id, status: revoked.status };
  }

  async reactivateMembership(
    context: RequestContext,
    membershipId: string,
    request: ReactivateMembershipRequest,
  ): Promise<MembershipAccessResponseDto> {
    assertCanAssignRole(context, request.roleCode);
    const reactivated = await this.repository.reactivateMembership(context, membershipId, request.roleCode);
    return {
      membershipId: reactivated.membership_id,
      status: reactivated.status,
      roleCode: request.roleCode,
    };
  }

  async updateTenantStatus(
    context: RequestContext,
    tenantId: string,
    status: "active" | "suspended" | "revoked",
    suspensionDuration?: string,
    reason?: string,
  ) {
    const requiredPermission = status === "suspended"
      ? "tenant.suspend"
      : status === "active"
        ? "tenant.reactivate"
        : "tenant.revoke";
    if (!context.isPlatformAdmin || !context.permissions.includes(requiredPermission)) {
      throw permissionDenied();
    }
    try {
      const updated = await this.repository.setTenantStatus(context, tenantId, status, suspensionDuration, reason);
      return {
        tenantId: updated.tenant_id,
        status: updated.status,
        suspensionEndsAt: updated.suspension_ends_at?.toISOString() ?? null,
        revokedAt: updated.revoked_at?.toISOString() ?? null,
      };
    } catch (error) {
      if (isPgInvalidStatusTransition(error)) {
        throw new ConflictException({
          code: "TENANT_STATUS_TRANSITION_INVALID",
          message: "The requested tenant lifecycle transition is not allowed.",
        });
      }
      throw error;
    }
  }

  async resetTenantAdministratorPassword(
    context: RequestContext,
    tenantId: string,
    request: ResetTenantAdministratorPasswordRequest,
  ): Promise<TenantAdministratorPasswordResetResponseDto> {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.update")) {
      throw permissionDenied();
    }
    const administrator = await this.repository.getActiveTenantAdministrator(context, tenantId);
    if (!administrator) {
      throw new NotFoundException({ code: "TENANT_ADMIN_NOT_FOUND", message: "No active Tenant Administrator was found for this tenant." });
    }
    await this.repository.auditTenantAdministratorPasswordReset(context, tenantId, administrator.user_id, "requested");
    await this.repository.updateTenantAdministratorPassword(context, tenantId, administrator.user_id, await this.passwords.hash(request.password));
    await this.repository.auditTenantAdministratorPasswordReset(context, tenantId, administrator.user_id, "succeeded");
    return { tenantId, email: administrator.email, passwordChangedAt: new Date().toISOString() };
  }
}

function assertCanAssignRole(context: RequestContext, roleCode: TenantRoleCode): void {
  if (roleCode === "TENANT_OWNER" && !context.isPlatformAdmin) {
    throw invitationRoleNotAllowed();
  }
  if (context.isPlatformAdmin) return;
  if (context.roles.includes("TENANT_OWNER") && includesRole(ownerInviteRoles, roleCode)) return;
  if (context.roles.includes("TENANT_ADMIN") && includesRole(adminInviteRoles, roleCode)) return;
  throw invitationRoleNotAllowed();
}

function includesRole(roles: readonly string[], roleCode: string): boolean {
  return roles.includes(roleCode);
}

function mapTenantRow(row: {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly owner_name: string | null;
  readonly owner_email: string | null;
  readonly pending_invitation_id: string | null;
  readonly status: string;
  readonly employee_count: number;
  readonly client_count: number;
  readonly created_at: Date;
  readonly usage_percent: number;
  readonly administrator_membership_id?: string | null;
  readonly administrator_name?: string | null;
  readonly administrator_email?: string | null;
  readonly administrator_membership_status?: string | null;
  readonly administrator_last_login_at?: Date | null;
  readonly administrator_last_logout_at?: Date | null;
  readonly administrator_password_changed_at?: Date | null;
}) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    owner: {
      name:
        row.owner_name ??
        (row.status === "cancelled" ? "Invitation cancelled" : "Invitation pending"),
      email: row.owner_email ?? "",
    },
    pendingInvitationId: row.pending_invitation_id,
    status: row.status,
    employeeCount: row.employee_count,
    clientCount: row.client_count,
    createdAt: row.created_at.toISOString(),
    usagePercent: row.usage_percent,
    tenantAdministrator: row.administrator_membership_id
      ? {
        membershipId: row.administrator_membership_id,
        name: row.administrator_name ?? "Tenant Administrator",
        email: row.administrator_email ?? "",
        membershipStatus: row.administrator_membership_status ?? "active",
        lastLoginAt: row.administrator_last_login_at?.toISOString() ?? null,
        lastLogoutAt: row.administrator_last_logout_at?.toISOString() ?? null,
        passwordChangedAt: row.administrator_password_changed_at?.toISOString() ?? null,
      }
      : null,
  };
}

function countryName(countryCode: string): string {
  const names: Record<string, string> = {
    IN: "India",
    US: "United States",
    SG: "Singapore",
    CA: "Canada",
    GB: "United Kingdom",
  };
  return names[countryCode] ?? countryCode;
}


function isPgUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function isPgCheckError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23514";
}

function isPgInvalidStatusTransition(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P0001";
}

function isTenantAdminEmailConflict(error: unknown): boolean {
  return isPgUniqueError(error) && String((error as Record<string, unknown>).message ?? "").includes("Tenant Administrator email");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function emailAlreadyExists(): ConflictException {
  return new ConflictException({
    code: "EMAIL_ALREADY_EXISTS",
    message: "This email is already associated with an existing user or tenant. Please provide a unique email address for the new Tenant Admin.",
  });
}
