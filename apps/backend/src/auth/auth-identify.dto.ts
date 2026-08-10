import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const identifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export type IdentifyEmailRequest = z.infer<typeof identifyEmailSchema>;

export class IdentifyEmailRequestDto {
  @ApiProperty({ type: String, format: "email" })
  email!: string;
}

export class IdentifyEmailResponseDto {
  @ApiProperty({ enum: ["password"] })
  method!: "password";

  @ApiPropertyOptional({ type: String })
  displayName?: string;
}
