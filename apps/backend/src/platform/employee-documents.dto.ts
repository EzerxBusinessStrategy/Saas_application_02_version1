import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const createEmployeeDocumentSchema = z.object({
  clientId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  fileName: z.string().trim().min(1).max(260),
  fileType: z.string().trim().min(1).max(24),
  sizeBytes: z.coerce.number().int().nonnegative().default(0),
  category: z.string().trim().min(1).max(80).default("supporting"),
  storageKey: z.string().trim().min(1).max(1000),
  contentType: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().uuid().optional(),
  recipientTenantAdminIds: z.array(z.string().uuid()).default([]),
  recipientManagerIds: z.array(z.string().uuid()).default([]),
}).superRefine((value, ctx) => {
  if (!value.recipientTenantAdminIds.length && !value.recipientManagerIds.length) {
    ctx.addIssue({
      code: "custom",
      path: ["recipientTenantAdminIds"],
      message: "Select at least one Tenant Admin or Manager.",
    });
  }
});
export type CreateEmployeeDocumentRequest = z.infer<typeof createEmployeeDocumentSchema>;

export const createEmployeeDocumentUploadUrlSchema = z.object({
  clientId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(260),
  contentType: z.string().trim().min(1).max(160),
  sizeBytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateEmployeeDocumentUploadUrlRequest = z.infer<typeof createEmployeeDocumentUploadUrlSchema>;

export class EmployeeDocumentRecipientOptionDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) email!: string | null;
}

export class EmployeeDocumentClientOptionDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
}

export class EmployeeDocumentTaskOptionDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) clientId!: string;
  @ApiProperty({ type: String }) title!: string;
}

export class EmployeeDocumentOptionsDto {
  @ApiProperty({ type: () => EmployeeDocumentClientOptionDto, isArray: true })
  clients!: readonly EmployeeDocumentClientOptionDto[];
  @ApiProperty({ type: () => EmployeeDocumentTaskOptionDto, isArray: true })
  tasks!: readonly EmployeeDocumentTaskOptionDto[];
  @ApiProperty({ type: () => EmployeeDocumentRecipientOptionDto, isArray: true })
  tenantAdmins!: readonly EmployeeDocumentRecipientOptionDto[];
  @ApiProperty({ type: () => EmployeeDocumentRecipientOptionDto, isArray: true })
  managers!: readonly EmployeeDocumentRecipientOptionDto[];
}

export class EmployeeDocumentDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) clientId!: string;
  @ApiProperty({ type: String }) client!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) fileName!: string;
  @ApiProperty({ type: String }) fileType!: string;
  @ApiProperty({ type: Number }) sizeBytes!: number;
  @ApiProperty({ type: String }) category!: string;
  @ApiProperty({ type: String }) uploadedBy!: string;
  @ApiProperty({ type: String }) uploadedById!: string;
  @ApiProperty({ type: String }) updatedOn!: string;
  @ApiProperty({ type: String, enum: ["active", "archived"] }) status!: "active" | "archived";
  @ApiProperty({ type: String, enum: ["pending", "approved", "rejected"] })
  clientDecisionStatus!: "pending" | "approved" | "rejected";
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionAt!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionBy!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionComment!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shareReason!: string | null;
  @ApiProperty({ type: [String] }) recipientTenantAdminIds!: readonly string[];
  @ApiProperty({ type: [String] }) recipientManagerIds!: readonly string[];
}

export class EmployeeDocumentsResponseDto {
  @ApiProperty({ type: () => EmployeeDocumentDto, isArray: true })
  documents!: readonly EmployeeDocumentDto[];
}
