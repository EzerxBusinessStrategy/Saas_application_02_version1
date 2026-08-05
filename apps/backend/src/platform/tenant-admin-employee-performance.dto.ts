import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MoneyDto } from "./tenant-admin-dashboard.dto";

export class QueryEmployeePerformanceDto {
  @ApiPropertyOptional({ type: String, example: "2026-04-01" })
  from?: string;

  @ApiPropertyOptional({ type: String, example: "2027-03-31" })
  to?: string;

  @ApiPropertyOptional({ type: String, format: "uuid" })
  clientId?: string;

  @ApiPropertyOptional({ type: String, format: "uuid" })
  employeeId?: string;

  @ApiPropertyOptional({ type: String, example: "active" })
  status?: string;

  @ApiPropertyOptional({ type: String, example: "performanceScore" })
  sortBy?: string;

  @ApiPropertyOptional({ type: String, example: "desc" })
  sortOrder?: "asc" | "desc";

  @ApiPropertyOptional({ type: Number, example: 1 })
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, example: 20 })
  limit?: number = 20;
}

export class PeriodInfoDto {
  @ApiProperty({ type: String, example: "2026-04-01" })
  from!: string;

  @ApiProperty({ type: String, example: "2027-03-31" })
  to!: string;

  @ApiProperty({ type: String, example: "FY 2026–27" })
  label!: string;
}

export class PerformanceSummaryDto {
  @ApiProperty({ type: Number })
  eligibleEmployees!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  tenantAverageSlaMinutes!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  tenantTaskCompletionRatePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  tenantOnTimeCompletionRatePercent!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  topEmployeeId!: string | null;
}

export class EmployeeRefDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  role!: string;

  @ApiProperty({ type: String })
  status!: string;
}

export class ScoreComponentsDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  taskScore!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  slaScore!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  revenueScore!: number | null;
}

export class EmployeePerformanceItemDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  rank!: number | null;

  @ApiProperty({ type: () => EmployeeRefDto })
  employee!: EmployeeRefDto;

  @ApiProperty({ type: Number })
  clientsServed!: number;

  @ApiProperty({ type: Number })
  totalAssignedTasks!: number;

  @ApiProperty({ type: Number })
  completedTasks!: number;

  @ApiProperty({ type: Number })
  openTasks!: number;

  @ApiProperty({ type: Number })
  overdueTasks!: number;

  @ApiProperty({ type: Number })
  cancelledTasks!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  completionRatePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  onTimeCompletionRatePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  averageSlaMinutes!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  medianSlaMinutes!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  slaEfficiencyRatio!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  slaUnavailableReason!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  slaMetRatePercent!: number | null;

  @ApiPropertyOptional({ type: () => MoneyDto, nullable: true })
  revenueContribution!: MoneyDto | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  revenueUnavailableReason!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  performanceScore!: number | null;

  @ApiProperty({ type: () => ScoreComponentsDto })
  scoreComponents!: ScoreComponentsDto;

  @ApiProperty({ type: [String] })
  availableComponents!: readonly string[];

  @ApiProperty({ type: Boolean })
  isEligibleForRanking!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  eligibilityReason!: string | null;
}

export class PaginationInfoDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  totalPages!: number;
}

export class TenantAdminEmployeePerformanceResponseDto {
  @ApiProperty({ type: () => PeriodInfoDto })
  period!: PeriodInfoDto;

  @ApiProperty({ type: () => PerformanceSummaryDto })
  summary!: PerformanceSummaryDto;

  @ApiProperty({ type: () => [EmployeePerformanceItemDto] })
  items!: readonly EmployeePerformanceItemDto[];

  @ApiProperty({ type: () => PaginationInfoDto })
  pagination!: PaginationInfoDto;
}

export class ClientPerformanceBreakdownDto {
  @ApiProperty({ type: String, format: "uuid" })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: Number })
  assignedTasks!: number;

  @ApiProperty({ type: Number })
  completedTasks!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  completionRatePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  onTimeCompletionRatePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  averageSlaMinutes!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  slaEfficiencyRatio!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  slaMetRatePercent!: number | null;

  @ApiPropertyOptional({ type: () => MoneyDto, nullable: true })
  revenueContribution!: MoneyDto | null;
}

export class EmployeeTaskHistoryItemDto {
  @ApiProperty({ type: String, format: "uuid" })
  taskId!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: String, format: "date-time" })
  assignedAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  completedAt!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  allowedSlaMinutes!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  actualSlaMinutes!: number | null;

  @ApiProperty({ type: String })
  slaStatus!: string;

  @ApiPropertyOptional({ type: () => MoneyDto, nullable: true })
  revenueContribution!: MoneyDto | null;
}

export class EmployeePerformanceDetailDto {
  @ApiProperty({ type: () => PeriodInfoDto })
  period!: PeriodInfoDto;

  @ApiProperty({ type: () => EmployeePerformanceItemDto })
  performance!: EmployeePerformanceItemDto;

  @ApiProperty({ type: () => [ClientPerformanceBreakdownDto] })
  clientBreakdown!: readonly ClientPerformanceBreakdownDto[];

  @ApiProperty({ type: () => [EmployeeTaskHistoryItemDto] })
  taskHistory!: readonly EmployeeTaskHistoryItemDto[];
}
