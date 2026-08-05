import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

const pageNumber = z.coerce.number().int().positive().default(1);
const pageSizeNumber = z.coerce.number().int().min(1).max(100).default(10);
const optionalText = z.preprocess((value) => (value === "" ? undefined : value), z.string().trim().optional());
const optionalUuid = z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional());

export const tenantAdminClientsQuerySchema = z.object({
  query: optionalText,
  status: z.enum(["active", "onboarding", "paused", "archived"]).optional(),
  service: optionalUuid,
  manager: optionalUuid,
  deadline: z.enum(["any", "upcoming", "none"]).optional().default("any"),
  revenueMin: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["name", "revenue", "outstanding", "deadline"]).optional().default("name"),
  page: pageNumber,
  pageSize: pageSizeNumber,
});
export type TenantAdminClientsQuery = z.infer<typeof tenantAdminClientsQuerySchema>;

export const tenantAdminContactInputSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  role: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional().default(""),
  preference: z.enum(["email", "phone", "portal"]).optional().default("email"),
  primary: z.boolean().optional().default(false),
  notes: z.string().trim().max(1000).optional().default(""),
  status: z.enum(["active", "archived"]).optional(),
});
export type TenantAdminContactInput = z.infer<typeof tenantAdminContactInputSchema>;

export const tenantAdminContactUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  role: z.string().trim().max(160).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional(),
  preference: z.enum(["email", "phone", "portal"]).optional(),
  primary: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export class TenantAdminClientOptionDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class TenantAdminClientContactDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  role!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String })
  phone!: string;

  @ApiProperty({ enum: ["email", "phone", "portal"] })
  preference!: "email" | "phone" | "portal";

  @ApiProperty({ enum: ["active", "archived"] })
  status!: "active" | "archived";

  @ApiProperty({ type: Boolean })
  primary!: boolean;

  @ApiProperty({ type: String })
  notes!: string;
}

export class TenantAdminClientItemDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  currencyCode!: string;

  @ApiProperty({ type: () => TenantAdminClientContactDto })
  primaryContact!: Pick<TenantAdminClientContactDto, "name" | "email">;

  @ApiProperty({ type: Number })
  activeServices!: number;

  @ApiProperty({ type: [String] })
  services!: readonly string[];

  @ApiProperty({ type: [String] })
  managers!: readonly string[];

  @ApiProperty({ type: Number })
  revenueAmount!: number;

  @ApiProperty({ type: Number })
  outstandingAmount!: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  upcomingDeadline!: string | null;

  @ApiProperty({ enum: ["active", "onboarding", "paused", "archived"] })
  status!: "active" | "onboarding" | "paused" | "archived";

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: Number })
  openTasks!: number;

  @ApiProperty({ type: Number })
  atRiskTasks!: number;

  @ApiProperty({ type: Number })
  onboardingProgress!: number;

  @ApiProperty({ type: Number })
  documentProgress!: number;
}

export class TenantAdminClientFiltersDto {
  @ApiProperty({ type: () => [TenantAdminClientOptionDto] })
  services!: readonly TenantAdminClientOptionDto[];

  @ApiProperty({ type: () => [TenantAdminClientOptionDto] })
  managers!: readonly TenantAdminClientOptionDto[];
}

export class TenantAdminClientsResponseDto {
  @ApiProperty({ type: () => [TenantAdminClientItemDto] })
  items!: readonly TenantAdminClientItemDto[];

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  pageCount!: number;

  @ApiProperty({ type: Number })
  totalItems!: number;

  @ApiProperty({ type: () => TenantAdminClientFiltersDto })
  filters!: TenantAdminClientFiltersDto;
}

export class TenantAdminClientDetailDto extends TenantAdminClientItemDto {
  @ApiProperty({ type: () => [TenantAdminClientContactDto] })
  contacts!: readonly TenantAdminClientContactDto[];

  @ApiProperty({ type: Array })
  engagements!: readonly Record<string, unknown>[];

  @ApiProperty({ type: Array })
  workGroups!: readonly Record<string, unknown>[];

  @ApiProperty({ type: Array })
  tasks!: readonly Record<string, unknown>[];

  @ApiProperty({ type: Array })
  invoices!: readonly Record<string, unknown>[];

  @ApiProperty({ type: Array })
  activity!: readonly Record<string, unknown>[];
}
