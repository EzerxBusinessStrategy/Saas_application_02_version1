import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const createClientServiceCommentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  body: z.string().trim().min(2).max(2000),
});

export type CreateClientServiceComment = z.infer<typeof createClientServiceCommentSchema>;

export class CreateClientServiceCommentDto {
  @ApiProperty({ type: String, format: "uuid" }) idempotencyKey!: string;
  @ApiProperty({ type: String }) body!: string;
}

export class ClientServiceCommentDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) serviceId!: string;
  @ApiProperty({ type: String }) serviceName!: string;
  @ApiProperty({ type: String }) body!: string;
  @ApiProperty({ type: Boolean }) replayed!: boolean;
  @ApiProperty({ type: String }) createdAt!: string;
}
