import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const createSessionPolicySchema = z.object({
  rememberMe: z.boolean().optional().default(false),
});

export type CreateSessionPolicyRequest = z.infer<typeof createSessionPolicySchema>;

export class SessionPolicyResponseDto {
  @ApiProperty({ type: Boolean })
  rememberMe!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  absoluteExpiresAt!: string;
}
