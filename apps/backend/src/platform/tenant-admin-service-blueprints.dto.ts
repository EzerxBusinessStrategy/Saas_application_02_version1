import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import { tenantAdminBillingUnits } from "./tenant-admin-tasks.dto";
import {
  serviceBlueprintDueRuleTypes,
  serviceBlueprintFrequencies,
} from "./service-blueprint-recurrence";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoCountry = z.string().trim().length(2).transform((value) => value.toUpperCase());

export const serviceBlueprintDueRuleSchema = z.object({
  type: z.enum(serviceBlueprintDueRuleTypes),
  day: z.coerce.number().int().min(1).max(31).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  days: z.coerce.number().int().min(0).max(90).optional(),
  date: isoDate.optional(),
});

export const serviceBlueprintTaskSchema = z.object({
  taskType: z.string().trim().min(2).max(160),
  frequency: z.enum(serviceBlueprintFrequencies),
  dueRule: serviceBlueprintDueRuleSchema,
  unitType: z.enum(tenantAdminBillingUnits),
  rateAmount: z.coerce.number().nonnegative(),
  taxCode: z.string().trim().max(80).optional().default(""),
  enabled: z.boolean().optional().default(true),
});

export const upsertServiceBlueprintSchema = z.object({
  countryCode: isoCountry.default("IN"),
  currencyCode: z.enum(["INR", "USD", "GBP"]).default("INR"),
  effectiveFrom: isoDate,
  tasks: z.array(serviceBlueprintTaskSchema).min(1).max(40),
});
export type UpsertServiceBlueprintRequest = z.infer<typeof upsertServiceBlueprintSchema>;

export const replaceEmployeeServiceCapabilitiesSchema = z.object({
  serviceIds: z.array(z.string().uuid()).max(50),
});
export type ReplaceEmployeeServiceCapabilitiesRequest = z.infer<typeof replaceEmployeeServiceCapabilitiesSchema>;

export class ServiceBlueprintDueRuleDto {
  @ApiProperty({ enum: serviceBlueprintDueRuleTypes })
  type!: (typeof serviceBlueprintDueRuleTypes)[number];

  @ApiPropertyOptional({ type: Number, nullable: true })
  day?: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  month?: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  days?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  date?: string;
}

export class ServiceBlueprintTaskDto {
  @ApiProperty({ type: String })
  taskType!: string;

  @ApiProperty({ enum: serviceBlueprintFrequencies })
  frequency!: (typeof serviceBlueprintFrequencies)[number];

  @ApiProperty({ type: () => ServiceBlueprintDueRuleDto })
  dueRule!: ServiceBlueprintDueRuleDto;

  @ApiProperty({ enum: tenantAdminBillingUnits })
  unitType!: (typeof tenantAdminBillingUnits)[number];

  @ApiProperty({ type: Number })
  rateAmount!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  taxCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  rateCardItemId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  calendarRuleId!: string | null;

  @ApiProperty({ type: Boolean })
  enabled!: boolean;
}

export class ServiceBlueprintDto {
  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  countryCode!: string;

  @ApiProperty({ type: String })
  currencyCode!: string;

  @ApiProperty({ type: Number })
  estimatedAnnualTotal!: number;

  @ApiProperty({ type: () => [ServiceBlueprintTaskDto] })
  tasks!: readonly ServiceBlueprintTaskDto[];
}

export class EmployeeServiceCapabilityDto {
  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  serviceName!: string;

  @ApiProperty({ type: String })
  status!: "active" | "inactive";
}

export class EmployeeServiceCapabilitiesResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  employeeId!: string;

  @ApiProperty({ type: () => [EmployeeServiceCapabilityDto] })
  capabilities!: readonly EmployeeServiceCapabilityDto[];
}
