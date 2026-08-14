import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

const optionalUuid = z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional());

export const createTenantDocumentSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  fileName: z.string().trim().min(1).max(260),
  fileType: z.string().trim().min(1).max(24),
  sizeBytes: z.coerce.number().int().nonnegative().default(0),
  category: z.string().trim().min(1).max(80).default("supporting"),
  storageKey: z.string().trim().min(1).max(1000),
  contentType: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().uuid().optional(),
  recipientEmployeeIds: z.array(z.string().uuid()).default([]),
  shareReason: z.string().trim().max(1000).optional().default(""),
});
export type CreateTenantDocumentRequest = z.infer<typeof createTenantDocumentSchema>;

export const createTenantDocumentUploadUrlSchema = z.object({
  clientId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(260),
  contentType: z.string().trim().min(1).max(160),
  sizeBytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateTenantDocumentUploadUrlRequest = z.infer<typeof createTenantDocumentUploadUrlSchema>;

export const createTenantInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(64),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().nonnegative(),
  currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("INR"),
  visibility: z.enum(["client", "internal"]).default("client"),
  fileName: z.string().trim().min(1).max(260),
  fileType: z.string().trim().min(1).max(24),
  sizeBytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
  storageKey: z.string().trim().min(1).max(1000),
  contentType: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateTenantInvoiceRequest = z.infer<typeof createTenantInvoiceSchema>;

export class DocumentUploadUrlDto {
  @ApiProperty({ type: String }) storageBucket!: string;
  @ApiProperty({ type: String }) storageKey!: string;
  @ApiProperty({ type: String }) signedUrl!: string;
}

export class DocumentDownloadUrlDto {
  @ApiProperty({ type: String }) url!: string;
}

const invoiceDiscountSchema = z.object({
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.coerce.number().nonnegative().default(0),
}).superRefine((value, ctx) => {
  if (value.discountType === "percentage" && value.discountValue > 100) {
    ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Percentage discount cannot exceed 100." });
  }
});

export const createTaskInvoiceSchema = z.object({
  billableTaskEntryId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(64),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).and(invoiceDiscountSchema);
export type CreateTaskInvoiceRequest = z.infer<typeof createTaskInvoiceSchema>;

export const listTenantFinanceQuerySchema = z.object({
  clientId: optionalUuid,
});
export type ListTenantFinanceQuery = z.infer<typeof listTenantFinanceQuerySchema>;

export class TenantDocumentDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) clientId!: string;
  @ApiProperty({ type: String }) client!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) fileName!: string;
  @ApiProperty({ type: String }) fileType!: string;
  @ApiProperty({ type: Number }) sizeBytes!: number;
  @ApiProperty({ type: String }) category!: string;
  @ApiProperty({ type: String }) uploadedBy!: string;
  @ApiProperty({ type: String }) updatedOn!: string;
  @ApiProperty({ type: String, enum: ["active", "archived"] }) status!: "active" | "archived";
  @ApiProperty({ type: String, enum: ["pending", "approved", "rejected"] }) clientDecisionStatus!: "pending" | "approved" | "rejected";
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionAt!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionBy!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionComment!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shareReason!: string | null;
}

export class TenantDocumentsResponseDto {
  @ApiProperty({ type: () => TenantDocumentDto, isArray: true })
  documents!: readonly TenantDocumentDto[];
}

export class TenantInvoiceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) clientId!: string;
  @ApiProperty({ type: String }) client!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) taskTitle!: string | null;
  @ApiProperty({ type: String }) invoiceNumber!: string;
  @ApiProperty({ type: String }) issuedOn!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) dueOn!: string | null;
  @ApiProperty({ type: String }) currency!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: String, enum: ["draft", "sent", "partial", "paid", "overdue"] }) status!: string;
  @ApiProperty({ type: String, enum: ["client", "internal"] }) visibility!: "client" | "internal";
  @ApiProperty({ type: String }) uploadedBy!: string;
  @ApiProperty({ type: String }) updatedOn!: string;
}

export class TenantInvoicesResponseDto {
  @ApiProperty({ type: () => TenantInvoiceDto, isArray: true })
  invoices!: readonly TenantInvoiceDto[];
}

export class TenantBillableTaskEntryDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) taskId!: string;
  @ApiProperty({ type: String }) taskTitle!: string;
  @ApiProperty({ type: String }) clientId!: string;
  @ApiProperty({ type: String }) client!: string;
  @ApiProperty({ type: String }) currency!: string;
  @ApiProperty({ type: Number }) grossAmount!: number;
  @ApiProperty({ type: Number }) discountAmount!: number;
  @ApiProperty({ type: Number }) netAmount!: number;
}

export class TenantBillableTaskEntriesResponseDto {
  @ApiProperty({ type: () => TenantBillableTaskEntryDto, isArray: true })
  entries!: readonly TenantBillableTaskEntryDto[];
}
