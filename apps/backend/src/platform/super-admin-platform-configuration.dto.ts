import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

const trimmedValue = (label: string) => z.string().trim().min(1, `${label} is required.`).max(160);

export const updatePlatformConfigurationSchema = z.object({
  platformName: trimmedValue("Platform name"),
  defaultBrand: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour."),
  senderName: trimmedValue("Email sender name"),
});

export type UpdatePlatformConfigurationRequest = z.infer<typeof updatePlatformConfigurationSchema>;

export class PlatformConfigurationResponseDto {
  @ApiProperty({ example: "SaaS App", type: String })
  platformName!: string;

  @ApiProperty({ example: "#3C50E0", type: String })
  defaultBrand!: string;

  @ApiProperty({ example: "SaaS App", type: String })
  senderName!: string;
}
