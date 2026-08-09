import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

const hexColour = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).transform((value) => value.toUpperCase());

export class ClientPortalProfileDto {
  @ApiProperty({ type: String }) portalName!: string;
  @ApiProperty({ type: String }) primaryColour!: string;
  @ApiProperty({ type: String }) sidebarColour!: string;
  @ApiProperty({ type: String }) surfaceColour!: string;
}

export const updateClientPortalProfileSchema = z.object({
  portalName: z.string().trim().min(2).max(80),
  primaryColour: hexColour,
  sidebarColour: hexColour,
  surfaceColour: hexColour,
});

export type UpdateClientPortalProfile = z.infer<typeof updateClientPortalProfileSchema>;
