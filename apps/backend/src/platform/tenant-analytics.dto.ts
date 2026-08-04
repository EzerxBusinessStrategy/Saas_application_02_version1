import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().optional(),
);

export const tenantAnalyticsQuerySchema = z
  .object({
    tenantId: optionalString.pipe(z.string().uuid().optional()),
    financialYearId: optionalString.pipe(z.string().uuid().optional()),
    from: optionalString.pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: optionalString.pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  })
  .superRefine((value, context) => {
    if ((value.from && !value.to) || (!value.from && value.to)) {
      context.addIssue({ code: "custom", message: "from and to must be supplied together." });
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from." });
    }
    if (value.financialYearId && (value.from || value.to)) {
      context.addIssue({ code: "custom", message: "Choose a financial year or a custom date range." });
    }
  });

export type TenantAnalyticsQuery = z.infer<typeof tenantAnalyticsQuerySchema>;

export class TenantAnalyticsFinancialYearDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String }) label!: string;
  @ApiProperty({ type: String, format: "date" }) startDate!: string;
  @ApiProperty({ type: String, format: "date" }) endDate!: string;
}

export class TenantAnalyticsTenantDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) currencyCode!: string | null;
}

export class TenantAnalyticsMetricsDto {
  @ApiProperty({ type: String }) turnover!: string;
  @ApiProperty({ type: String }) collected!: string;
  @ApiProperty({ type: String }) outstanding!: string;
  @ApiProperty({ type: Number }) invoices!: number;
  @ApiProperty({ type: Number }) payments!: number;
  @ApiProperty({ type: Number }) clients!: number;
  @ApiProperty({ type: Number }) activeEmployees!: number;
  @ApiProperty({ type: Number }) totalTasks!: number;
  @ApiProperty({ type: Number }) completedTasks!: number;
  @ApiProperty({ type: Number }) slaCompliance!: number;
  @ApiProperty({ type: Number }) employeeCompletionRate!: number;
}

export class TenantAnalyticsTrendDto {
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: String }) turnover!: string;
  @ApiProperty({ type: String }) collected!: string;
}

export class TenantAnalyticsClientRevenueDto {
  @ApiProperty({ type: String }) clientName!: string;
  @ApiProperty({ type: String }) turnover!: string;
}

export class TenantAnalyticsResponseDto {
  @ApiProperty({ type: () => [TenantAnalyticsTenantDto] }) tenants!: readonly TenantAnalyticsTenantDto[];
  @ApiPropertyOptional({ type: () => TenantAnalyticsTenantDto, nullable: true }) selectedTenant!: TenantAnalyticsTenantDto | null;
  @ApiProperty({ type: () => [TenantAnalyticsFinancialYearDto] }) financialYears!: readonly TenantAnalyticsFinancialYearDto[];
  @ApiPropertyOptional({ type: () => TenantAnalyticsFinancialYearDto, nullable: true }) selectedFinancialYear!: TenantAnalyticsFinancialYearDto | null;
  @ApiPropertyOptional({ type: String, format: "date", nullable: true }) from!: string | null;
  @ApiPropertyOptional({ type: String, format: "date", nullable: true }) to!: string | null;
  @ApiProperty({ type: () => TenantAnalyticsMetricsDto }) metrics!: TenantAnalyticsMetricsDto;
  @ApiProperty({ type: () => [TenantAnalyticsTrendDto] }) trend!: readonly TenantAnalyticsTrendDto[];
  @ApiProperty({ type: () => [TenantAnalyticsClientRevenueDto] }) clientRevenue!: readonly TenantAnalyticsClientRevenueDto[];
}
