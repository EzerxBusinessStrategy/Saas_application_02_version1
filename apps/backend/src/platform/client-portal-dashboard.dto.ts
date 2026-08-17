import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  tenantAdminDashboardQuerySchema,
  type TenantAdminDashboardQuery,
} from "./tenant-admin-dashboard.dto";

export const clientPortalDashboardQuerySchema = tenantAdminDashboardQuerySchema;
export type ClientPortalDashboardQuery = TenantAdminDashboardQuery;

export class ClientPortalDashboardServiceTaskDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) plannedDueAt!: string | null;
  @ApiProperty({ type: Number }) rateAmount!: number;
  @ApiProperty({ type: Number }) discountAmount!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) discountType!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) discountValue!: number | null;
  @ApiProperty({ type: String }) currencyCode!: string;
}

export class ClientPortalDashboardServiceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) engagementName!: string;
  @ApiProperty({ type: String }) serviceName!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) nextDueAt!: string | null;
  @ApiProperty({ type: Number }) openTasks!: number;
  @ApiProperty({ type: Number }) completedTasks!: number;
  @ApiProperty({ type: Number }) totalTasks!: number;
  @ApiProperty({ type: Number }) progressPercent!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) assignedEmployeeName!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) estimatedTotal!: number | null;
  @ApiProperty({ type: Number }) taskTotal!: number;
  @ApiProperty({ type: Number }) discountAmount!: number;
  @ApiProperty({ type: Number }) discountPercent!: number;
  @ApiProperty({ type: Number }) amountDue!: number;
  @ApiProperty({ type: Number }) totalDue!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) currencyCode!: string | null;
  @ApiProperty({ type: () => ClientPortalDashboardServiceTaskDto, isArray: true })
  tasks!: readonly ClientPortalDashboardServiceTaskDto[];
}

export class ClientPortalDashboardRequestDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty({ type: String }) serviceName!: string;
  @ApiProperty({ type: String }) countryCode!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) requestedDueDate!: string | null;
  @ApiProperty({ type: String }) submittedAt!: string;
  @ApiProperty({ type: String }) updatedAt!: string;
}

export class ClientPortalDashboardInvoiceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) invoiceNumber!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) taskTitle!: string | null;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty({ type: String }) issuedOn!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) dueOn!: string | null;
  @ApiProperty({ type: String }) currencyCode!: string;
  @ApiProperty({ type: Number }) totalAmount!: number;
  @ApiProperty({ type: Number }) paidAmount!: number;
  @ApiProperty({ type: Number }) outstandingAmount!: number;
}

export class ClientPortalDashboardPeriodDto {
  @ApiProperty({ type: String, format: "date", example: "2026-08-01" })
  from!: string;

  @ApiProperty({ type: String, format: "date", example: "2027-08-17" })
  to!: string;

  @ApiProperty({ enum: ["query", "last_30_days", "upcoming_year"] })
  source!: "query" | "last_30_days" | "upcoming_year";
}

export class ClientPortalDashboardResponseDto {
  @ApiProperty({ type: () => ClientPortalDashboardPeriodDto })
  period!: ClientPortalDashboardPeriodDto;
  @ApiProperty({ type: Number }) activeServices!: number;
  @ApiProperty({ type: Number }) pendingTasks!: number;
  @ApiProperty({ type: Number }) completedTasks!: number;
  @ApiProperty({ type: Number }) openRequests!: number;
  @ApiProperty({ type: Number }) outstandingInvoices!: number;
  @ApiProperty({ type: String }) currencyCode!: string;
  @ApiProperty({ type: () => ClientPortalDashboardServiceDto, isArray: true })
  services!: readonly ClientPortalDashboardServiceDto[];
  @ApiProperty({ type: () => ClientPortalDashboardRequestDto, isArray: true })
  requests!: readonly ClientPortalDashboardRequestDto[];
  @ApiProperty({ type: () => ClientPortalDashboardInvoiceDto, isArray: true })
  invoices!: readonly ClientPortalDashboardInvoiceDto[];
}
