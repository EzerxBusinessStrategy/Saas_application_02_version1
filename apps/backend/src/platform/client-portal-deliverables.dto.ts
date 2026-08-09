import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export class ClientPortalDeliverableDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) fileName!: string;
  @ApiProperty({ type: String }) fileType!: string;
  @ApiProperty({ type: Number }) sizeBytes!: number;
  @ApiProperty({ type: String }) category!: string;
  @ApiProperty({ type: String }) uploadedBy!: string;
  @ApiProperty({ type: String }) updatedOn!: string;
  @ApiProperty({ type: String, enum: ["pending", "approved", "rejected"] }) clientDecisionStatus!: "pending" | "approved" | "rejected";
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionAt!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) clientDecisionComment!: string | null;
}

export class ClientPortalDeliverablesResponseDto {
  @ApiProperty({ type: () => ClientPortalDeliverableDto, isArray: true })
  deliverables!: readonly ClientPortalDeliverableDto[];
}

export const decideClientPortalDeliverableSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (value.decision === "rejected" && !(value.comment ?? "").trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["comment"],
      message: "Enter a reason before rejecting this deliverable.",
    });
  }
});

export type DecideClientPortalDeliverableRequest = z.infer<typeof decideClientPortalDeliverableSchema>;
