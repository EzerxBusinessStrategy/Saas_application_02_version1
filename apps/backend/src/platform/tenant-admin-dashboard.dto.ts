import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import {
  DASHBOARD_MAX_FUTURE_DAYS,
  DASHBOARD_MAX_SPAN_DAYS,
  DASHBOARD_MIN_FROM,
  ISO_DATE_PATTERN,
  addIsoDateDays,
  isoDateDiffDays,
  utcTodayIso,
} from "./tenant-admin-dashboard.period";

export const updateTenantProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
});
export type UpdateTenantProfileRequest = z.infer<typeof updateTenantProfileSchema>;

const optionalIsoDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().regex(ISO_DATE_PATTERN).optional(),
);

export const tenantAdminDashboardQuerySchema = z
  .object({
    from: optionalIsoDate,
    to: optionalIsoDate,
  })
  .superRefine((value, context) => {
    if ((value.from && !value.to) || (!value.from && value.to)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "from and to must be supplied together." });
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be on or after from.",
      });
    }
    if (value.from && value.to) {
      if (isoDateDiffDays(value.from, value.to) > DASHBOARD_MAX_SPAN_DAYS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Date range cannot exceed ${DASHBOARD_MAX_SPAN_DAYS} days.`,
        });
      }
      if (value.from < DASHBOARD_MIN_FROM) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["from"],
          message: `from cannot be earlier than ${DASHBOARD_MIN_FROM}.`,
        });
      }
      const maxTo = addIsoDateDays(utcTodayIso(), DASHBOARD_MAX_FUTURE_DAYS);
      if (value.to > maxTo) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["to"],
          message: `to cannot be more than ${DASHBOARD_MAX_FUTURE_DAYS} days in the future.`,
        });
      }
    }
  })
  .default({});
export type TenantAdminDashboardQuery = z.infer<typeof tenantAdminDashboardQuerySchema>;

export class TenantInfoDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, example: "INR" })
  currencyCode!: string;
}

export class TenantProfileDto extends TenantInfoDto {
  @ApiProperty({ type: String, example: "Asia/Kolkata" })
  timezone!: string;
}

export class FinancialYearInfoDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, example: "FY 2026–27" })
  label!: string;

  @ApiProperty({ type: String, example: "2026-04-01" })
  startsOn!: string;

  @ApiProperty({ type: String, example: "2027-03-31" })
  endsOn!: string;
}

export class MoneyDto {
  @ApiProperty({ type: String, example: "125000.00" })
  amount!: string;

  @ApiProperty({ type: String, example: "INR" })
  currencyCode!: string;
}

export class TenantAdminMetricsDto {
  @ApiProperty({ type: Number })
  activeClients!: number;

  @ApiPropertyOptional({ type: () => MoneyDto, nullable: true })
  totalSales!: MoneyDto | null;

  @ApiProperty({ type: Number })
  openTasks!: number;

  @ApiProperty({ type: Number })
  completedTasks!: number;

  @ApiPropertyOptional({ type: () => MoneyDto, nullable: true })
  outstanding!: MoneyDto | null;
}

export class RecentActivityItemDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  action!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  resourceType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  resourceId!: string | null;

  @ApiProperty({ type: String })
  result!: string;

  @ApiProperty({ type: Object })
  metadata!: Record<string, unknown>;

  @ApiProperty({ type: String })
  actor!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}

export class OrganisationSetupItemDto {
  @ApiProperty({ type: String })
  key!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: Boolean })
  completed!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  destination!: string | null;
}

export class OrganisationSetupDto {
  @ApiProperty({ type: Number })
  completed!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  completionPercent!: number;

  @ApiProperty({ type: () => [OrganisationSetupItemDto] })
  items!: readonly OrganisationSetupItemDto[];
}

export class UpcomingDeadlineItemDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  taskId!: string;

  @ApiProperty({ type: String })
  taskTitle!: string;

  @ApiProperty({ type: String })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: String, format: "date-time" })
  dueAt!: string;

  @ApiProperty({ type: String })
  priority!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  workGroupName!: string | null;

  @ApiProperty({ type: Number })
  assigneeCount!: number;
}

export class TenantAdminDashboardPeriodDto {
  @ApiProperty({ type: String, format: "date", example: "2026-04-01" })
  from!: string;

  @ApiProperty({ type: String, format: "date", example: "2027-03-31" })
  to!: string;

  @ApiProperty({ enum: ["query", "financial_year", "last_30_days"] })
  source!: "query" | "financial_year" | "last_30_days";
}

export class TenantAdminDashboardResponseDto {
  @ApiProperty({ type: () => TenantInfoDto })
  tenant!: TenantInfoDto;

  @ApiProperty({ type: () => TenantAdminDashboardPeriodDto })
  period!: TenantAdminDashboardPeriodDto;

  @ApiPropertyOptional({ type: () => FinancialYearInfoDto, nullable: true })
  financialYear!: FinancialYearInfoDto | null;

  @ApiProperty({ type: Boolean, example: true })
  financialDataAvailable!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: "CURRENT_FINANCIAL_YEAR_NOT_CONFIGURED" })
  financialDataUnavailableReason!: string | null;

  @ApiProperty({ type: () => TenantAdminMetricsDto })
  metrics!: TenantAdminMetricsDto;

  @ApiProperty({ type: () => [RecentActivityItemDto] })
  recentActivity!: readonly RecentActivityItemDto[];

  @ApiProperty({ type: () => OrganisationSetupDto })
  organisationSetup!: OrganisationSetupDto;

  @ApiProperty({ type: () => [UpcomingDeadlineItemDto] })
  upcomingDeadlines!: readonly UpcomingDeadlineItemDto[];
}

export class OpenTaskAssigneeDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, format: "date-time" })
  assignedAt!: string;
}

export class OpenTaskItemDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: "Latest known public IP from client portal sign-in." })
  clientPublicIp!: string | null;

  @ApiProperty({ type: String })
  serviceId!: string;

  @ApiProperty({ type: String })
  serviceName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  workGroupId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  workGroupName!: string | null;

  @ApiProperty({ type: String })
  priority!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ type: String })
  slaStatus!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  plannedDueAt!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  assignedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  completedAt!: string | null;

  @ApiProperty({ type: () => [OpenTaskAssigneeDto] })
  assignees!: readonly OpenTaskAssigneeDto[];
}

export class TenantAdminCompletedTasksResponseDto {
  @ApiProperty({ type: () => TenantAdminDashboardPeriodDto })
  period!: TenantAdminDashboardPeriodDto;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [OpenTaskItemDto] })
  tasks!: readonly OpenTaskItemDto[];
}

export class TenantAdminOpenTasksResponseDto {
  @ApiProperty({ type: () => TenantAdminDashboardPeriodDto })
  period!: TenantAdminDashboardPeriodDto;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [OpenTaskItemDto] })
  tasks!: readonly OpenTaskItemDto[];
}
