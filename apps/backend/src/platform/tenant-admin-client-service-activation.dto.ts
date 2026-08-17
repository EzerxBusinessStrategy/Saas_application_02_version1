import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import {
  serviceBlueprintTaskSchema,
  ServiceBlueprintDueRuleDto,
} from "./tenant-admin-service-blueprints.dto";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const serviceOnboardingAssigneesQuerySchema = z.object({
  serviceId: z.string().uuid(),
});
export type ServiceOnboardingAssigneesQuery = z.infer<typeof serviceOnboardingAssigneesQuerySchema>;

export const activateServiceOnboardingTaskSchema = serviceBlueprintTaskSchema.extend({
  title: z.string().trim().min(2).max(160).optional(),
});

export const activateClientServiceSchema = z.object({
  serviceId: z.string().uuid(),
  assignedEmployeeId: z.string().uuid(),
  tasks: z.array(activateServiceOnboardingTaskSchema).min(1).max(40),
});

export const activateClientServicesSchema = z.object({
  idempotencyKey: z.string().uuid(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).default("IN"),
  currencyCode: z.enum(["INR", "USD", "GBP"]).default("INR"),
  startDate: isoDate.optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  services: z.array(activateClientServiceSchema).min(1).max(20),
});
export type ActivateClientServicesRequest = z.infer<typeof activateClientServicesSchema>;

export class ServiceOnboardingCatalogTaskDto {
  @ApiProperty({ type: String })
  taskType!: string;

  @ApiProperty({ type: String })
  frequency!: string;

  @ApiProperty({ type: () => ServiceBlueprintDueRuleDto })
  dueRule!: ServiceBlueprintDueRuleDto;

  @ApiProperty({ type: String })
  unitType!: string;

  @ApiProperty({ type: Number })
  rateAmount!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  taxCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  rateCardItemId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  calendarRuleId!: string | null;
}

export class ServiceOnboardingCatalogItemDto {
  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: Number })
  estimatedAnnualTotal!: number;

  @ApiProperty({ type: String })
  currencyCode!: string;

  @ApiProperty({ type: Boolean })
  alreadyActive!: boolean;

  @ApiProperty({ type: () => [ServiceOnboardingCatalogTaskDto] })
  tasks!: readonly ServiceOnboardingCatalogTaskDto[];
}

export class ServiceOnboardingCatalogResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: () => [ServiceOnboardingCatalogItemDto] })
  services!: readonly ServiceOnboardingCatalogItemDto[];
}

export class ServiceOnboardingAssigneeDto {
  @ApiProperty({ type: String, format: "uuid" })
  employeeId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty({ type: Boolean })
  serviceCapable!: boolean;

  @ApiProperty({ type: Number })
  activeTasks!: number;

  @ApiProperty({ type: Number })
  weeklyCapacityHours!: number;
}

export class ServiceOnboardingAssigneesResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: () => [ServiceOnboardingAssigneeDto] })
  employees!: readonly ServiceOnboardingAssigneeDto[];
}

export class ActivatedClientServiceDto {
  @ApiProperty({ type: String, format: "uuid" })
  engagementId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  serviceName!: string;

  @ApiProperty({ type: String, format: "uuid" })
  assignedEmployeeId!: string;

  @ApiProperty({ type: String })
  assignedEmployeeName!: string;

  @ApiProperty({ type: Number })
  taskCount!: number;

  @ApiProperty({ type: Number })
  estimatedTotal!: number;

  @ApiProperty({ type: Boolean })
  alreadyActive!: boolean;
}

export class ActivateClientServicesResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  clientId!: string;

  @ApiProperty({ type: Boolean })
  replayed!: boolean;

  @ApiProperty({ type: Number })
  estimatedTotal!: number;

  @ApiProperty({ type: String })
  currencyCode!: string;

  @ApiProperty({ type: () => [ActivatedClientServiceDto] })
  services!: readonly ActivatedClientServiceDto[];
}
