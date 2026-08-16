import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import {
  activateServiceOnboardingTaskSchema,
  ActivatedClientServiceDto,
  ServiceOnboardingCatalogTaskDto,
} from "./tenant-admin-client-service-activation.dto";
import { ServiceBlueprintDueRuleDto } from "./tenant-admin-service-blueprints.dto";

const isoCountry = z.string().trim().length(2).transform((value) => value.toUpperCase());

export const clientServiceCatalogueQuerySchema = z
  .object({
    countryCode: isoCountry.default("IN"),
    currencyCode: z.enum(["INR", "USD", "GBP"]).default("INR"),
  })
  .default({ countryCode: "IN", currencyCode: "INR" });
export type ClientServiceCatalogueQuery = z.infer<typeof clientServiceCatalogueQuerySchema>;

export const clientServiceRequestKindSchema = z.enum(["catalogue", "custom"]);
export const clientServiceRequestStatusSchema = z.enum(["submitted", "accepted", "rejected", "cancelled"]);

export const createClientServiceRequestItemSchema = z.object({
  serviceId: z.string().uuid(),
  tasks: z.array(activateServiceOnboardingTaskSchema).min(1).max(40),
});

export const createClientServiceRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    kind: clientServiceRequestKindSchema,
    countryCode: isoCountry.default("IN"),
    currencyCode: z.enum(["INR", "USD", "GBP"]).default("INR"),
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).optional().default(""),
    services: z.array(createClientServiceRequestItemSchema).max(20).optional().default([]),
  })
  .superRefine((value, context) => {
    if (value.kind === "catalogue" && value.services.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one service.",
        path: ["services"],
      });
    }
    if (value.kind === "custom") {
      if (!value.title) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Title is required.",
          path: ["title"],
        });
      }
      if (!value.description?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Description is required.",
          path: ["description"],
        });
      }
    }
  });
export type CreateClientServiceRequest = z.infer<typeof createClientServiceRequestSchema>;

export const listTenantServiceRequestsQuerySchema = z
  .object({
    status: clientServiceRequestStatusSchema.optional(),
  })
  .default({});
export type ListTenantServiceRequestsQuery = z.infer<typeof listTenantServiceRequestsQuerySchema>;

export const acceptClientServiceRequestSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
  assignments: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        assignedEmployeeId: z.string().uuid(),
      }),
    )
    .max(20)
    .default([]),
});
export type AcceptClientServiceRequest = z.infer<typeof acceptClientServiceRequestSchema>;

export const rejectClientServiceRequestSchema = z.object({
  remarks: z.string().trim().min(2).max(2000),
});
export type RejectClientServiceRequest = z.infer<typeof rejectClientServiceRequestSchema>;

export class ClientServiceCatalogueTaskDto extends ServiceOnboardingCatalogTaskDto {}

export class ClientServiceCatalogueItemDto {
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

  @ApiProperty({ type: Boolean })
  alreadyRequested!: boolean;

  @ApiProperty({ type: () => [ClientServiceCatalogueTaskDto] })
  tasks!: readonly ClientServiceCatalogueTaskDto[];
}

export class ClientServiceCatalogueResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: () => [ClientServiceCatalogueItemDto] })
  services!: readonly ClientServiceCatalogueItemDto[];
}

export class ClientServiceRequestTaskDto {
  @ApiProperty({ type: String })
  taskType!: string;

  @ApiPropertyOptional({ type: String })
  title?: string;

  @ApiProperty({ type: String })
  frequency!: string;

  @ApiProperty({ type: () => ServiceBlueprintDueRuleDto })
  dueRule!: ServiceBlueprintDueRuleDto;

  @ApiProperty({ type: String })
  unitType!: string;

  @ApiProperty({ type: Number })
  rateAmount!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  taxCode?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  enabled?: boolean;
}

export class ClientServiceRequestItemDto {
  @ApiProperty({ type: String, format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: String })
  serviceName!: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  assignedEmployeeId!: string | null;

  @ApiProperty({ type: Number })
  estimatedTotal!: number;

  @ApiProperty({ type: () => [ClientServiceRequestTaskDto] })
  tasks!: readonly ClientServiceRequestTaskDto[];
}

export class ClientServiceRequestDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["catalogue", "custom"] })
  kind!: "catalogue" | "custom";

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ enum: ["submitted", "accepted", "rejected", "cancelled"] })
  status!: "submitted" | "accepted" | "rejected" | "cancelled";

  @ApiProperty({ type: String, format: "uuid" })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: String })
  countryCode!: string;

  @ApiProperty({ type: String })
  currencyCode!: string;

  @ApiProperty({ type: Number })
  estimatedTotal!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewRemarks!: string | null;

  @ApiProperty({ type: Boolean })
  replayed!: boolean;

  @ApiProperty({ type: String })
  submittedAt!: string;

  @ApiProperty({ type: String })
  updatedAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewedAt!: string | null;

  @ApiProperty({ type: () => [ClientServiceRequestItemDto] })
  services!: readonly ClientServiceRequestItemDto[];

  @ApiPropertyOptional({ type: () => [ActivatedClientServiceDto] })
  activatedServices?: readonly ActivatedClientServiceDto[];
}

export class ClientServiceRequestListResponseDto {
  @ApiProperty({ type: () => [ClientServiceRequestDto] })
  requests!: readonly ClientServiceRequestDto[];
}
