import { ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const updateReviewSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  internalNotes: z.string().trim().max(4000).optional(),
  resolution: z.string().trim().max(4000).optional(),
});

export type UpdateReviewRequest = z.infer<typeof updateReviewSchema>;

export class UpdateReviewDto {
  @ApiPropertyOptional({ enum: ["IN_PROGRESS", "COMPLETED", "CANCELLED"] })
  status?: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

  @ApiPropertyOptional({ type: String })
  internalNotes?: string;

  @ApiPropertyOptional({ type: String })
  resolution?: string;
}
