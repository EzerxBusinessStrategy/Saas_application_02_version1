import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const tenantRoleCodes = [
  "TENANT_OWNER",
  "TENANT_ADMIN",
  "FINANCE_USER",
  "HR_OPERATIONS_USER",
  "MANAGER",
  "EMPLOYEE",
  "CLIENT_USER",
] as const;

export type TenantRoleCode = (typeof tenantRoleCodes)[number];

const optionalFutureIsoDate = z
  .string()
  .datetime({ offset: true })
  .optional();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableText = z.string().trim().max(160).optional().or(z.literal(""));

export const createTenantWithOwnerInvitationSchema = z.object({
  company: z.object({
    displayName: z.string().trim().min(2).max(160),
    legalName: z.string().trim().min(2).max(200),
    tenantCode: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$/),
    slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/),
    countryCode: z.string().trim().length(2).toUpperCase(),
    reportingCurrencyCode: z.string().trim().length(3).toUpperCase(),
    timezone: z.string().trim().min(1).max(64),
    industry: nullableText,
    registrationNumber: nullableText,
    taxIdentifier: nullableText,
  }),
  financialYear: z.object({
    source: z.enum(["COUNTRY_SUGGESTION_CONFIRMED", "CUSTOM_CONFIRMED"]),
    label: z.string().trim().min(2).max(80),
    startsOn: isoDate,
    endsOn: isoDate,
    templateId: z.string().uuid().optional(),
    overrideReason: z.string().trim().max(500).optional().or(z.literal("")),
  }),
  tenantAdministrator: z.object({
    fullName: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(320).toLowerCase(),
    password: z.string().min(8).max(128),
    phone: z.string().trim().min(1).max(30),
  }),
});

export const createInvitationSchema = z.object({
  email: z.string().trim().email().max(320).toLowerCase(),
  displayName: z.string().trim().min(1).max(160).optional(),
  roleCode: z.enum(tenantRoleCodes),
  expiresAt: optionalFutureIsoDate,
});

export const closeInvitationSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const updateTenantStatusSchema = z.object({
  status: z.enum(["active", "suspended", "revoked"]),
  suspensionDuration: z.enum(["24h", "48h", "72h", "96h", "1w", "1m", "6m"]).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  revokeConfirmation: z.literal("REVOKE").optional(),
}).superRefine((value, context) => {
  if (value.status === "suspended" && !value.suspensionDuration) {
    context.addIssue({ code: "custom", path: ["suspensionDuration"], message: "Choose a suspension duration." });
  }
  if (value.status === "revoked" && value.revokeConfirmation !== "REVOKE") {
    context.addIssue({ code: "custom", path: ["revokeConfirmation"], message: "Confirm tenant revocation." });
  }
});

export const resetTenantAdministratorPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export const acceptInvitationSchema = z.object({
  displayName: z.string().trim().min(1).max(160).optional(),
});

export const revokeMembershipSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const reactivateMembershipSchema = z.object({
  roleCode: z.enum(tenantRoleCodes),
});

export type CreateTenantWithOwnerInvitationRequest = z.infer<
  typeof createTenantWithOwnerInvitationSchema
>;
export type CreateInvitationRequest = z.infer<typeof createInvitationSchema>;
export type CloseInvitationRequest = z.infer<typeof closeInvitationSchema>;
export type UpdateTenantStatusRequest = z.infer<typeof updateTenantStatusSchema>;
export type ResetTenantAdministratorPasswordRequest = z.infer<typeof resetTenantAdministratorPasswordSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationSchema>;
export type RevokeMembershipRequest = z.infer<typeof revokeMembershipSchema>;
export type ReactivateMembershipRequest = z.infer<typeof reactivateMembershipSchema>;

export class TenantStatusResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  tenantId!: string;

  @ApiProperty({ enum: ["active", "suspended", "revoked"] })
  status!: "active" | "suspended" | "revoked";

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  suspensionEndsAt?: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  revokedAt?: string | null;
}

export class UpdateTenantStatusDto {
  @ApiProperty({ enum: ["active", "suspended", "revoked"] })
  status!: "active" | "suspended" | "revoked";

  @ApiPropertyOptional({ enum: ["24h", "48h", "72h", "96h", "1w", "1m", "6m"] })
  suspensionDuration?: "24h" | "48h" | "72h" | "96h" | "1w" | "1m" | "6m";

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  reason?: string;

  @ApiPropertyOptional({ enum: ["REVOKE"] })
  revokeConfirmation?: "REVOKE";
}

export class ResetTenantAdministratorPasswordDto {
  @ApiProperty({ type: String, minLength: 8, writeOnly: true }) password!: string;
}

export class TenantAdministratorPasswordResetResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) tenantId!: string;

  @ApiProperty({ type: String, format: "email" }) email!: string;

  @ApiProperty({ type: String, format: "date-time" }) passwordChangedAt!: string;
}

export class CompanyInfoDto {
  @ApiProperty({ type: String, example: "ABC Technologies" })
  displayName!: string;

  @ApiProperty({ type: String, example: "ABC Technologies Private Limited" })
  legalName!: string;

  @ApiProperty({ type: String, example: "ABC001" })
  tenantCode!: string;

  @ApiProperty({ type: String, example: "abc-technologies" })
  slug!: string;

  @ApiProperty({ type: String, example: "IN" })
  countryCode!: string;

  @ApiProperty({ type: String, example: "INR" })
  reportingCurrencyCode!: string;

  @ApiProperty({ type: String, example: "Asia/Kolkata" })
  timezone!: string;

  @ApiPropertyOptional({ type: String, example: "Technology" })
  industry?: string;

  @ApiPropertyOptional({ type: String, example: "U12345WB2026PTC123456" })
  registrationNumber?: string;

  @ApiPropertyOptional({ type: String, example: "19ABCDE1234F1Z5" })
  taxIdentifier?: string;
}

export class FinancialYearInfoDto {
  @ApiProperty({ enum: ["COUNTRY_SUGGESTION_CONFIRMED", "CUSTOM_CONFIRMED"], example: "COUNTRY_SUGGESTION_CONFIRMED" })
  source!: "COUNTRY_SUGGESTION_CONFIRMED" | "CUSTOM_CONFIRMED";

  @ApiProperty({ type: String, example: "FY 2026-27" })
  label!: string;

  @ApiProperty({ type: String, example: "2026-04-01" })
  startsOn!: string;

  @ApiProperty({ type: String, example: "2027-03-31" })
  endsOn!: string;

  @ApiPropertyOptional({ type: String, format: "uuid" })
  templateId?: string;

  @ApiPropertyOptional({ type: String, example: "Custom business requirements" })
  overrideReason?: string;
}

export class TenantAdministratorInfoDto {
  @ApiProperty({ type: String, example: "Rahul Sharma" })
  fullName!: string;

  @ApiProperty({ type: String, format: "email", example: "rahul@abctech.com" })
  email!: string;

  @ApiProperty({ type: String, minLength: 8, writeOnly: true }) password!: string;

  @ApiProperty({ type: String, example: "+919876543210" })
  phone!: string;

}

export class CreateTenantWithOwnerInvitationDto {
  @ApiProperty({ type: () => CompanyInfoDto })
  company!: CompanyInfoDto;

  @ApiProperty({ type: () => FinancialYearInfoDto })
  financialYear!: FinancialYearInfoDto;

  @ApiProperty({ type: () => TenantAdministratorInfoDto })
  tenantAdministrator!: TenantAdministratorInfoDto;
}

export class CreateInvitationDto {
  @ApiProperty({ type: String, format: "email", example: "priya@abctech.com" })
  email!: string;

  @ApiPropertyOptional({ type: String, example: "Priya Sen" })
  displayName?: string;

  @ApiProperty({ enum: tenantRoleCodes, example: "MANAGER" })
  roleCode!: TenantRoleCode;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  expiresAt?: string;
}

export class CloseInvitationDto {
  @ApiPropertyOptional({ type: String, example: "Wrong role selected." })
  reason?: string;
}

export class AcceptInvitationDto {
  @ApiPropertyOptional({ type: String, example: "Priya Sen" })
  displayName?: string;
}

export class RevokeMembershipDto {
  @ApiProperty({ type: String, example: "Employee left the organisation." })
  reason!: string;
}

export class ReactivateMembershipDto {
  @ApiProperty({ enum: tenantRoleCodes, example: "EMPLOYEE" })
  roleCode!: TenantRoleCode;
}

export class CreateTenantWithOwnerInvitationResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  tenantId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  financialYearId!: string;

  @ApiProperty({ type: String, format: "uuid" }) membershipId!: string;

  @ApiProperty({ enum: ["active"] }) tenantStatus!: "active";
}

export class TenantCreationCountryDto {
  @ApiProperty({ type: String, example: "IN" })
  countryCode!: string;

  @ApiProperty({ type: String, example: "India" })
  name!: string;

  @ApiProperty({ type: String, example: "INR" })
  reportingCurrencyCode!: string;

  @ApiProperty({ type: String, example: "Asia/Kolkata" })
  timezone!: string;
}

export class SuggestedFinancialYearDto {
  @ApiProperty({ type: String, format: "uuid", example: "00000000-0000-0000-0000-000000000000" })
  id!: string;

  @ApiProperty({ type: String, example: "FY 2026-27" })
  label!: string;

  @ApiProperty({ type: String, example: "2026-04-01" })
  startsOn!: string;

  @ApiProperty({ type: String, example: "2027-03-31" })
  endsOn!: string;

  @ApiProperty({ enum: ["COUNTRY_SUGGESTION"], example: "COUNTRY_SUGGESTION" })
  source!: "COUNTRY_SUGGESTION";
}

export class TenantCreationOptionsResponseDto {
  @ApiProperty({ type: [TenantCreationCountryDto] })
  countries!: TenantCreationCountryDto[];

  @ApiPropertyOptional({ type: String, example: "IN" })
  countryCode?: string;

  @ApiPropertyOptional({ type: String, example: "COUNTRY_FIXED" })
  policyMode?: string;

  @ApiPropertyOptional({ type: () => SuggestedFinancialYearDto })
  suggestedFinancialYear?: SuggestedFinancialYearDto;

  @ApiPropertyOptional({ type: [String], example: ["03-31", "06-30", "09-30", "12-31"] })
  suggestedYearEnds?: string[];

  @ApiPropertyOptional({ type: Boolean })
  confirmationRequired?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  customAllowed?: boolean;

  @ApiPropertyOptional({ type: String })
  guidance?: string;
}

export class InvitationResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "email" })
  email!: string;

  @ApiProperty({ enum: tenantRoleCodes })
  roleCode!: TenantRoleCode;

  @ApiProperty({ enum: ["pending", "accepted", "expired", "revoked", "cancelled"] })
  status!: string;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: string;
}

export class ClosedInvitationResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  invitationId!: string;

  @ApiProperty({ enum: ["cancelled", "revoked"] })
  status!: "cancelled" | "revoked";
}

export class AcceptedInvitationResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  tenantId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  userId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  membershipId!: string;

  @ApiProperty({ enum: tenantRoleCodes })
  roleCode!: TenantRoleCode;

  @ApiProperty({ enum: ["active"] })
  status!: "active";
}

export class MembershipAccessResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  membershipId!: string;

  @ApiProperty({ enum: ["active", "revoked"] })
  status!: "active" | "revoked";

  @ApiPropertyOptional({ enum: tenantRoleCodes })
  roleCode?: TenantRoleCode;
}
