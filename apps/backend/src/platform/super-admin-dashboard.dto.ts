import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

const optionalQueryString = z.preprocess(
  (value) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    return trimmed || undefined;
  },
  z.string().optional(),
);

export const dashboardHealthFilters = [
  "HIGH_PERFORMING",
  "HEALTHY",
  "DEVELOPING",
  "LOW",
] as const;

export const dashboardTenantStatusFilters = [
  "active",
  "suspended",
  "archived",
  "provisioning",
] as const;

export const dashboardPeriodModes = [
  "CURRENT_FY",
  "PREVIOUS_FY",
  "CUSTOM_RANGE",
] as const;

export const superAdminDashboardQuerySchema = z
  .object({
    from: optionalQueryString.pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: optionalQueryString.pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    periodMode: optionalQueryString.pipe(z.enum(dashboardPeriodModes).optional()),
    financialYearId: optionalQueryString.pipe(z.string().max(80).optional()),
    health: optionalQueryString.pipe(z.enum(dashboardHealthFilters).optional()),
    country: optionalQueryString.pipe(
      z
        .string()
        .regex(/^[A-Za-z]{2}$/)
        .transform((value) => value.toUpperCase())
        .optional(),
    ),
    search: optionalQueryString.pipe(z.string().max(120).optional()),
    tenantStatus: optionalQueryString.pipe(z.enum(dashboardTenantStatusFilters).optional()),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be on or after from",
      });
    }
  });

export type SuperAdminDashboardQuery = z.infer<typeof superAdminDashboardQuerySchema>;

export class SuperAdminDashboardQueryDto {
  @ApiPropertyOptional({ type: String, example: "2026-04-01" })
  from?: string;

  @ApiPropertyOptional({ type: String, example: "2027-03-31" })
  to?: string;

  @ApiPropertyOptional({ enum: dashboardPeriodModes, example: "CURRENT_FY" })
  periodMode?: (typeof dashboardPeriodModes)[number];

  @ApiPropertyOptional({ type: String, example: "fy-2026-27" })
  financialYearId?: string;

  @ApiPropertyOptional({ enum: dashboardHealthFilters, example: "HEALTHY" })
  health?: (typeof dashboardHealthFilters)[number];

  @ApiPropertyOptional({ type: String, example: "IN" })
  country?: string;

  @ApiPropertyOptional({ type: String, example: "ABC Technologies" })
  search?: string;

  @ApiPropertyOptional({ enum: dashboardTenantStatusFilters, example: "active" })
  tenantStatus?: (typeof dashboardTenantStatusFilters)[number];
}

export class SuperAdminIdentityDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, format: "email" })
  email!: string;

  @ApiProperty({ type: String, example: "SS" })
  initials!: string;
}

export class MoneyAmountDto {
  @ApiProperty({ type: String, example: "INR" })
  currencyCode!: string;

  @ApiProperty({ type: String, example: "48200000.00" })
  amount!: string;
}

export class SuperAdminDashboardMetricsDto {
  @ApiProperty({ type: Number })
  totalTenants!: number;

  @ApiProperty({ type: () => [MoneyAmountDto] })
  totalTurnoverByCurrency!: readonly MoneyAmountDto[];

  @ApiProperty({ type: () => [MoneyAmountDto] })
  collectedByCurrency!: readonly MoneyAmountDto[];

  @ApiProperty({ type: () => [MoneyAmountDto] })
  outstandingByCurrency!: readonly MoneyAmountDto[];

  @ApiProperty({ type: Number })
  lowHealthTenants!: number;
}

export class SuperAdminPlatformStatusDto {
  @ApiProperty({ type: Number })
  activeTenants!: number;

  @ApiProperty({ type: Number })
  suspendedTenants!: number;

  @ApiProperty({ type: Number })
  activeTenantUsers!: number;

  @ApiProperty({ type: Number })
  pendingTenantReviews!: number;
}

export class TenantHealthBandDto {
  @ApiProperty({ type: String, example: "HEALTHY" })
  code!: string;

  @ApiProperty({ type: String, example: "Healthy" })
  label!: string;

  @ApiProperty({ type: Number })
  minimumTurnover!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  maximumTurnover!: number | null;
}

export class TenantHealthCountDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  code!: string | null;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: Number })
  count!: number;
}

export class TenantTurnoverHealthDto {
  @ApiProperty({ type: String, format: "uuid" })
  tenantId!: string;

  @ApiProperty({ type: String })
  tenantName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  country!: string | null;

  @ApiProperty({ type: String })
  tenantStatus!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  currencyCode!: string | null;

  @ApiProperty({ type: String })
  turnover!: string;

  @ApiProperty({ type: String })
  collected!: string;

  @ApiProperty({ type: String })
  outstanding!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  growthPercentage!: number | null;

  @ApiProperty({ type: Number })
  collectionRate!: number;

  @ApiProperty({ type: Number })
  invoiceCount!: number;

  @ApiProperty({ type: Number })
  activeUsers!: number;

  @ApiProperty({ type: String })
  health!: string;

  @ApiProperty({ type: String })
  healthLabel!: string;

  @ApiProperty({ type: String })
  financialCondition!: "GOOD" | "ATTENTION_REQUIRED" | "AT_RISK";

  @ApiPropertyOptional({ type: () => FinancialYearOptionDto, nullable: true })
  financialYear!: FinancialYearOptionDto | null;

  @ApiProperty({ type: () => [FinancialYearOptionDto] })
  financialYears!: readonly FinancialYearOptionDto[];
}

export class DashboardActivityDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  tenantName!: string | null;

  @ApiProperty({ type: String })
  actorName!: string;

  @ApiProperty({ type: String, format: "date-time" })
  occurredAt!: string;
}

export class PlatformAlertDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  type!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  tenantId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  tenantName!: string | null;

  @ApiProperty({ enum: ["INFO", "WARNING", "CRITICAL"] })
  severity!: "INFO" | "WARNING" | "CRITICAL";

  @ApiPropertyOptional({ type: String, nullable: true })
  actionUrl!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ enum: ["OPEN", "VIEWED"] })
  status!: "OPEN" | "VIEWED";
}

export class TenantReviewDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  tenantId!: string;

  @ApiProperty({ type: String })
  tenantName!: string;

  @ApiProperty({ type: String })
  reviewType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"] })
  priority!: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

  @ApiPropertyOptional({ type: String, nullable: true })
  dueDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedReviewer!: string | null;

  @ApiProperty({ enum: ["PENDING", "IN_PROGRESS", "OVERDUE", "COMPLETED", "CANCELLED"] })
  status!: "PENDING" | "IN_PROGRESS" | "OVERDUE" | "COMPLETED" | "CANCELLED";
}

export class AuditActivityDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  actor!: string;

  @ApiProperty({ type: String })
  action!: string;

  @ApiProperty({ type: String })
  target!: string;

  @ApiProperty({ type: String, format: "date-time" })
  time!: string;

  @ApiProperty({ enum: ["COMPLETED", "DENIED", "FAILED", "PENDING"] })
  status!: "COMPLETED" | "DENIED" | "FAILED" | "PENDING";
}

export class TurnoverTrendPointDto {
  @ApiProperty({ type: String, format: "uuid" })
  tenantId!: string;

  @ApiProperty({ type: String })
  month!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  currencyCode!: string | null;

  @ApiProperty({ type: String })
  turnover!: string;
}

export class FinancialYearOptionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  startDate!: string;

  @ApiProperty({ type: String })
  endDate!: string;
}

export class FilterOptionsDto {
  @ApiProperty({ type: () => [FinancialYearOptionDto] })
  financialYears!: readonly FinancialYearOptionDto[];

  @ApiProperty({ type: [String] })
  countries!: readonly string[];

  @ApiProperty({ type: () => [TenantHealthBandDto] })
  healthBands!: readonly TenantHealthBandDto[];

  @ApiProperty({ type: () => [TenantHealthCountDto] })
  healthCounts!: readonly TenantHealthCountDto[];

  @ApiProperty({ type: [String] })
  tenantStatuses!: readonly string[];
}

export class AppliedDashboardFiltersDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  from!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  to!: string | null;

  @ApiProperty({ type: String })
  periodMode!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  financialYearId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  health!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  country!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  search!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  tenantStatus!: string | null;
}

export class SuperAdminDashboardResponseDto {
  @ApiProperty({ type: () => SuperAdminIdentityDto })
  superAdmin!: SuperAdminIdentityDto;

  @ApiProperty({ type: () => SuperAdminDashboardMetricsDto })
  metrics!: SuperAdminDashboardMetricsDto;

  @ApiProperty({ type: () => SuperAdminPlatformStatusDto })
  platformStatus!: SuperAdminPlatformStatusDto;

  @ApiProperty({ type: () => [TenantTurnoverHealthDto] })
  tenantHealth!: readonly TenantTurnoverHealthDto[];

  @ApiProperty({ type: () => [DashboardActivityDto] })
  recentActivity!: readonly DashboardActivityDto[];

  @ApiProperty({ type: () => [PlatformAlertDto] })
  platformAlerts!: readonly PlatformAlertDto[];

  @ApiProperty({ type: () => [TenantReviewDto] })
  tenantReviews!: readonly TenantReviewDto[];

  @ApiProperty({ type: () => [TurnoverTrendPointDto] })
  turnoverTrend!: readonly TurnoverTrendPointDto[];

  @ApiProperty({ type: () => FilterOptionsDto })
  filterOptions!: FilterOptionsDto;

  @ApiProperty({ type: () => AppliedDashboardFiltersDto })
  appliedFilters!: AppliedDashboardFiltersDto;
}
