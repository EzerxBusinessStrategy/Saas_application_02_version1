import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "../config/app-config.module";
import { AppConfig } from "../config/app-config";
import {
  AcceptedInvitationResponseDto,
  ClosedInvitationResponseDto,
  CreateInvitationRequest,
  CreateTenantWithOwnerInvitationRequest,
  CreateTenantWithOwnerInvitationResponseDto,
  TenantCreationOptionsResponseDto,
  MembershipAccessResponseDto,
  ReactivateMembershipRequest,
  RevokeMembershipRequest,
  TenantRoleCode,
} from "./access-admin.dto";
import { AccessAdminRepository } from "./access-admin.repository";
import {
  invitationRoleNotAllowed,
  permissionDenied,
  verifiedInviteEmailRequired,
} from "./auth-errors";
import { RequestContext, VerifiedAuthUser } from "./request-context";

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
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) { }

  async createTenantWithOwnerInvitation(
    context: RequestContext,
    request: CreateTenantWithOwnerInvitationRequest,
  ): Promise<CreateTenantWithOwnerInvitationResponseDto> {
    if (!context.isPlatformAdmin || !context.permissions.includes("tenant.create")) {
      throw permissionDenied();
    }
    await this.validateTenantCreation(context, request);
    const created = await this.createTenantOrThrowConflict(context, request);
    const invitationDeliveryStatus = await this.sendTenantAdminInvitationEmail(
      context,
      created.invitation_id,
      request.tenantAdministrator.email,
    );
    return {
      tenantId: created.tenant_id,
      financialYearId: created.financial_year_id,
      invitationId: created.invitation_id,
      tenantStatus: "pending_activation",
      invitationStatus: "pending",
      invitationDeliveryStatus,
    };
  }

  private async sendTenantAdminInvitationEmail(
    context: RequestContext,
    invitationId: string,
    email: string,
  ): Promise<"not_sent" | "sent" | "failed"> {
    if (!this.config.supabaseUrl || !this.config.supabaseAdminKey || !this.config.publicAppUrl) {
      return "not_sent";
    }
    const client = createClient(this.config.supabaseUrl, this.config.supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const redirectTo = `${this.config.publicAppUrl.replace(/\/+$/, "")}/accept-invitation?invitationId=${invitationId}`;
    const { error } = await client.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { invitationId },
    });
    const status = error ? "failed" : "sent";
    await this.repository.markInvitationDelivery(context, invitationId, status);
    return status;
  }

  private async validateTenantCreation(
    context: RequestContext,
    request: CreateTenantWithOwnerInvitationRequest,
  ): Promise<void> {
    const templates = await this.repository.listTenantCreationTemplates(context);

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
    const start = parseIsoDate(request.financialYear.startsOn);
    const end = parseIsoDate(request.financialYear.endsOn);
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

  private async createTenantOrThrowConflict(
    context: RequestContext,
    request: CreateTenantWithOwnerInvitationRequest,
  ) {
    try {
      return await this.repository.createTenantWithOwnerInvitation(context, request);
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
      // Surface the actual database error message in development so it is visible
      const pgMessage = (error as Record<string, unknown>)?.message;
      const pgDetail = (error as Record<string, unknown>)?.detail;
      const pgHint = (error as Record<string, unknown>)?.hint;
      const pgCode = (error as Record<string, unknown>)?.code;
      console.error("[createTenant] Unhandled DB error:", { pgCode, pgMessage, pgDetail, pgHint, error });
      throw error;
    }
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

    const suggested = suggestFinancialYear(selected, incorporationDate);
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

  async cancelTenantAdminInvitation(
    context: RequestContext,
    tenantId: string,
    reason?: string,
  ): Promise<ClosedInvitationResponseDto> {
    if (!context.isPlatformAdmin || !context.permissions.includes("invitation.cancel")) {
      throw permissionDenied();
    }
    try {
      const closed = await this.repository.cancelPendingTenantAdminInvitation(context, tenantId, reason);
      return { invitationId: closed.invitation_id, status: closed.status };
    } catch (error) {
      if (isPgUniqueError(error)) {
        throw new ConflictException({
          code: "INVITATION_NOT_PENDING",
          message: "The Tenant Administrator invitation has already been cancelled or accepted.",
        });
      }
      throw error;
    }
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
    status: "active" | "suspended",
    reason?: string,
  ) {
    const requiredPermission = status === "suspended" ? "tenant.suspend" : "tenant.reactivate";
    if (!context.isPlatformAdmin || !context.permissions.includes(requiredPermission)) {
      throw permissionDenied();
    }
    try {
      const updated = await this.repository.setTenantStatus(context, tenantId, status, reason);
      return { tenantId: updated.tenant_id, status: updated.status };
    } catch (error) {
      if (isPgInvalidStatusTransition(error)) {
        throw new ConflictException({
          code: "TENANT_STATUS_TRANSITION_INVALID",
          message: "Only active tenants can be suspended and only suspended tenants can be reactivated.",
        });
      }
      throw error;
    }
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

function suggestFinancialYear(
  template: {
    readonly policy_mode: string;
    readonly start_month: number;
    readonly start_day: number;
    readonly end_month: number;
    readonly end_day: number;
  },
  incorporationDate?: string,
): { readonly label: string; readonly startsOn: string; readonly endsOn: string } | null {
  const today = new Date();
  if (template.policy_mode === "INCORPORATION_DERIVED") {
    if (!incorporationDate) return null;
    const incorporated = parseIsoDate(incorporationDate);
    const anniversaryYear = incorporated.getUTCFullYear() + 1;
    const endsOn = lastDayOfMonth(anniversaryYear, incorporated.getUTCMonth() + 1);
    return {
      label: `FY ending ${endsOn.slice(0, 7)}`,
      startsOn: incorporationDate,
      endsOn,
    };
  }

  const startYear =
    today.getUTCMonth() + 1 > template.start_month ||
      (today.getUTCMonth() + 1 === template.start_month && today.getUTCDate() >= template.start_day)
      ? today.getUTCFullYear()
      : today.getUTCFullYear() - 1;
  const endYear = template.end_month < template.start_month ? startYear + 1 : startYear;
  const startsOn = iso(startYear, template.start_month, template.start_day);
  const endsOn = iso(endYear, template.end_month, template.end_day);
  return {
    label: template.start_month === 4 && template.end_month === 3
      ? `FY ${startYear}-${String(endYear).slice(2)}`
      : `FY ${startYear}`,
    startsOn,
    endsOn,
  };
}

function parseIsoDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({ code: "INVALID_DATE", message: "Date is invalid." });
  }
  return parsed;
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): string {
  return iso(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
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
