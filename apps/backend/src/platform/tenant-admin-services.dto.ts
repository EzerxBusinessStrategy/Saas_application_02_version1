import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import { tenantAdminBillingUnits } from "./tenant-admin-tasks.dto";

export const tenantAdminServiceCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  taskType: z.string().trim().min(2).max(160),
  unitType: z.enum(tenantAdminBillingUnits),
  rateAmount: z.coerce.number().nonnegative(),
  currencyCode: z.enum(["INR", "USD", "GBP"]),
  taxCode: z.string().trim().max(80).optional().default(""),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type TenantAdminServiceCreateRequest = z.infer<typeof tenantAdminServiceCreateSchema>;

export const tenantAdminServiceTaskStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});
export type TenantAdminServiceTaskStatusRequest = z.infer<typeof tenantAdminServiceTaskStatusSchema>;

export const tenantAdminServiceStatusSchema = tenantAdminServiceTaskStatusSchema;
export type TenantAdminServiceStatusRequest = TenantAdminServiceTaskStatusRequest;

export class TenantAdminServiceRateDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  rateCardName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  clientName!: string | null;

  @ApiProperty({ type: String })
  taskType!: string;

  @ApiProperty({ enum: tenantAdminBillingUnits })
  unitType!: (typeof tenantAdminBillingUnits)[number];

  @ApiProperty({ type: Number })
  rateAmount!: number;

  @ApiProperty({ type: String })
  currencyCode!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  taxCode!: string | null;

  @ApiProperty({ type: Number })
  tasksUsingRate!: number;

  @ApiProperty({ enum: ["active", "inactive"] })
  status!: "active" | "inactive";
}

export class TenantAdminServiceDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  status!: "active" | "inactive" | "archived";

  @ApiProperty({ type: () => [TenantAdminServiceRateDto] })
  rates!: readonly TenantAdminServiceRateDto[];
}

export class TenantAdminServicesResponseDto {
  @ApiProperty({ type: () => [TenantAdminServiceDto] })
  services!: readonly TenantAdminServiceDto[];
}

export class TenantAdminServiceTaskStatusResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  rateItemId!: string;

  @ApiProperty({ type: String })
  taskType!: string;

  @ApiProperty({ enum: ["active", "inactive"] })
  status!: "active" | "inactive";
}

export class TenantAdminServiceStatusResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ enum: ["active", "inactive"] })
  status!: "active" | "inactive";
}

export const tenantAdminServiceAllocationsQuerySchema = z.object({
  rateItemId: z.string().uuid().optional(),
});
export type TenantAdminServiceAllocationsQuery = z.infer<typeof tenantAdminServiceAllocationsQuerySchema>;

export class TenantAdminServiceAllocationEmployeeDto {
  @ApiProperty({ type: String, format: "uuid" }) employeeId!: string;
  @ApiProperty({ type: String }) employeeName!: string;
  @ApiProperty({ type: String }) assignmentStatus!: string;
}

export class TenantAdminServiceAllocationTaskDto {
  @ApiProperty({ type: String, format: "uuid" }) taskId!: string;
  @ApiProperty({ type: String }) taskTitle!: string;
  @ApiProperty({ type: String }) taskStatus!: string;
  @ApiProperty({ type: String, format: "uuid" }) clientId!: string;
  @ApiProperty({ type: String }) clientName!: string;
  @ApiProperty({ type: () => [TenantAdminServiceAllocationEmployeeDto] })
  employees!: readonly TenantAdminServiceAllocationEmployeeDto[];
}

export class TenantAdminServiceRateItemAllocationsDto {
  @ApiProperty({ type: String, format: "uuid" }) rateItemId!: string;
  @ApiProperty({ type: String }) taskType!: string;
  @ApiProperty({ type: Number }) rateAmount!: number;
  @ApiProperty({ type: String }) currencyCode!: string;
  @ApiProperty({ enum: tenantAdminBillingUnits }) unitType!: (typeof tenantAdminBillingUnits)[number];
  @ApiProperty({ type: () => [TenantAdminServiceAllocationTaskDto] })
  tasks!: readonly TenantAdminServiceAllocationTaskDto[];
}

export class TenantAdminServiceAllocationsResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) serviceId!: string;
  @ApiProperty({ type: String }) serviceName!: string;
  @ApiProperty({ type: () => [TenantAdminServiceRateItemAllocationsDto] })
  rateItems!: readonly TenantAdminServiceRateItemAllocationsDto[];
}

