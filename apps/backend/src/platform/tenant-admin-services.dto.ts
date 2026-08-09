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

