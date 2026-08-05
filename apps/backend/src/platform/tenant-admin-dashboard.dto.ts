import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TenantInfoDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, example: "INR" })
  currencyCode!: string;
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
  overdueTasks!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  slaCompliancePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  employeeUtilisationPercent!: number | null;

  @ApiPropertyOptional({ type: () => MoneyDto, nullable: true })
  outstanding!: MoneyDto | null;
}

export class RecentActivityItemDto {
  @ApiProperty({ type: String })
  action!: string;

  @ApiProperty({ type: String })
  actor!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
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
}
