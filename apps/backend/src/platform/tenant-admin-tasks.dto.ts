import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().uuid().optional(),
);

export const tenantAdminTaskPriorities = ["low", "normal", "high", "urgent"] as const;
export const tenantAdminTaskStatuses = [
  "draft",
  "requested",
  "open",
  "assigned",
  "in_progress",
  "submitted",
  "manager_review",
  "returned",
  "tenant_approval",
  "approved",
  "completed",
  "cancelled",
] as const;
export const tenantAdminTaskSlaStatuses = [
  "not_started",
  "running",
  "met",
  "near_breach",
  "breached",
  "not_applicable",
] as const;
export const tenantAdminBillingUnits = ["per_task", "per_hour", "per_filing", "per_unit"] as const;

export const listTenantAdminTasksQuerySchema = z.object({
  clientId: optionalUuid,
});
export type ListTenantAdminTasksQuery = z.infer<typeof listTenantAdminTasksQuerySchema>;

export const createTenantAdminTaskSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  priority: z.enum(tenantAdminTaskPriorities).default("normal"),
  plannedDueAt: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().datetime({ offset: true }).optional(),
  ),
  workGroupId: optionalUuid,
  employeeIds: z.array(z.string().uuid()).min(1).max(50),
  billing: z.discriminatedUnion("rateSource", [
    z.object({
      rateSource: z.literal("existing"),
      rateCardItemId: z.string().uuid(),
      quantity: z.coerce.number().positive().default(1),
      discountType: z.enum(["percentage", "fixed"]).optional(),
      discountValue: z.coerce.number().nonnegative().default(0),
    }),
    z.object({
      rateSource: z.literal("new"),
      taskType: z.string().trim().min(2).max(160),
      unitType: z.enum(tenantAdminBillingUnits),
      rateAmount: z.coerce.number().nonnegative(),
      currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
      taxCode: z.string().trim().max(80).optional().default(""),
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      saveToRateCard: z.boolean().default(true),
      oneTimeReason: z.string().trim().max(300).optional().default(""),
      quantity: z.coerce.number().positive().default(1),
      discountType: z.enum(["percentage", "fixed"]).optional(),
      discountValue: z.coerce.number().nonnegative().default(0),
    }).superRefine((value, ctx) => {
      if (!value.saveToRateCard && !value.oneTimeReason) {
        ctx.addIssue({
          code: "custom",
          path: ["oneTimeReason"],
          message: "Enter a reason for a one-time rate.",
        });
      }
    }),
  ]),
});
export type CreateTenantAdminTaskRequest = z.infer<typeof createTenantAdminTaskSchema>;

export const createTenantAdminEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  employeeCode: z.string().trim().max(40).optional().default(""),
  isManager: z.boolean().optional().default(false),
  skills: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  experienceLevel: z.enum(["junior", "mid", "senior", "lead"]).optional(),
  weeklyCapacityHours: z.coerce.number().int().min(1).max(168).optional().default(40),
});
export type CreateTenantAdminEmployeeRequest = z.infer<typeof createTenantAdminEmployeeSchema>;

export const updateTenantAdminEmployeeCapacitySchema = z.object({
  weeklyCapacityHours: z.coerce.number().int().min(1).max(168),
});
export type UpdateTenantAdminEmployeeCapacityRequest = z.infer<typeof updateTenantAdminEmployeeCapacitySchema>;

export const upsertTenantAdminWorkGroupSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientId: optionalUuid,
  managerEmployeeId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
});
export type UpsertTenantAdminWorkGroupRequest = z.infer<typeof upsertTenantAdminWorkGroupSchema>;

export class TenantAdminTaskOptionDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class TenantAdminTaskCountryOptionDto {
  @ApiProperty({ type: String })
  countryCode!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, format: "uuid" })
  financialYearId!: string;

  @ApiProperty({ type: String })
  financialYearLabel!: string;

  @ApiProperty({ type: String, format: "date" })
  startsOn!: string;

  @ApiProperty({ type: String, format: "date" })
  endsOn!: string;
}

export class TenantAdminEmployeeOptionDto extends TenantAdminTaskOptionDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  employeeCode!: string | null;

  @ApiProperty({ type: String, format: "email" })
  email!: string;

  @ApiProperty({ type: Boolean })
  isManager!: boolean;

  @ApiProperty({ type: () => [String] })
  skills!: readonly string[];

  @ApiProperty({ type: () => [String] })
  categories!: readonly string[];

  @ApiPropertyOptional({ enum: ["junior", "mid", "senior", "lead"], nullable: true })
  experienceLevel!: "junior" | "mid" | "senior" | "lead" | null;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  managerId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  managerName!: string | null;

  @ApiProperty({ type: Number })
  activeTasks!: number;

  @ApiProperty({ type: () => [TenantAdminTaskOptionDto] })
  workGroups!: readonly TenantAdminTaskOptionDto[];

  @ApiProperty({ type: String })
  employmentStatus!: string;

  @ApiProperty({ type: Number })
  weeklyCapacityHours!: number;
}

export class TenantAdminWorkGroupOptionDto extends TenantAdminTaskOptionDto {
  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  clientId!: string | null;
}

export class TenantAdminWorkGroupDto extends TenantAdminWorkGroupOptionDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  clientName!: string | null;

  @ApiProperty({ type: String, format: "uuid" })
  managerEmployeeId!: string;

  @ApiProperty({ type: String })
  managerName!: string;

  @ApiProperty({ type: Number })
  memberCount!: number;

  @ApiProperty({ type: () => [TenantAdminEmployeeOptionDto] })
  members!: readonly TenantAdminEmployeeOptionDto[];

  @ApiProperty({ type: String })
  status!: string;
}

export class TenantAdminWorkGroupsResponseDto {
  @ApiProperty({ type: () => [TenantAdminWorkGroupDto] })
  workGroups!: readonly TenantAdminWorkGroupDto[];
}

export class TenantAdminEmployeesResponseDto {
  @ApiProperty({ type: () => [TenantAdminEmployeeOptionDto] })
  employees!: readonly TenantAdminEmployeeOptionDto[];
}

export class TenantAdminRateCardItemOptionDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  clientId!: string | null;

  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  label!: string;

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
}

export class TenantAdminTaskOptionsResponseDto {
  @ApiProperty({ type: () => [TenantAdminTaskOptionDto] })
  clients!: readonly TenantAdminTaskOptionDto[];

  @ApiProperty({ type: () => [TenantAdminTaskOptionDto] })
  services!: readonly TenantAdminTaskOptionDto[];

  @ApiProperty({ type: () => [TenantAdminEmployeeOptionDto] })
  employees!: readonly TenantAdminEmployeeOptionDto[];

  @ApiProperty({ type: () => [TenantAdminWorkGroupOptionDto] })
  workGroups!: readonly TenantAdminWorkGroupOptionDto[];

  @ApiProperty({ type: () => [TenantAdminRateCardItemOptionDto] })
  rateItems!: readonly TenantAdminRateCardItemOptionDto[];

  @ApiProperty({ type: () => [TenantAdminTaskCountryOptionDto] })
  countries!: readonly TenantAdminTaskCountryOptionDto[];
}

export class TenantAdminTaskAssigneeDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class TenantAdminTaskItemDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: "uuid" })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  serviceName!: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  workGroupId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  workGroupName!: string | null;

  @ApiProperty({ enum: tenantAdminTaskPriorities })
  priority!: (typeof tenantAdminTaskPriorities)[number];

  @ApiProperty({ enum: tenantAdminTaskStatuses })
  status!: (typeof tenantAdminTaskStatuses)[number];

  @ApiProperty({ enum: tenantAdminTaskSlaStatuses })
  slaStatus!: (typeof tenantAdminTaskSlaStatuses)[number];

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  plannedDueAt!: string | null;

  @ApiProperty({ type: Number })
  assigneeCount!: number;

  @ApiProperty({ type: () => [TenantAdminTaskAssigneeDto] })
  assignees!: readonly TenantAdminTaskAssigneeDto[];
}

export class TenantAdminTasksResponseDto {
  @ApiProperty({ type: () => [TenantAdminTaskItemDto] })
  tasks!: readonly TenantAdminTaskItemDto[];
}
