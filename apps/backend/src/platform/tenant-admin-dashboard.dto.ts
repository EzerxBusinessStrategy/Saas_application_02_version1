import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const updateTenantProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
});
export type UpdateTenantProfileRequest = z.infer<typeof updateTenantProfileSchema>;

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

export class TenantAdminDashboardResponseDto {
  @ApiProperty({ type: () => TenantInfoDto })
  tenant!: TenantInfoDto;

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
