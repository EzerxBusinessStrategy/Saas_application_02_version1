import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const updateMyProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
});

export type UpdateMyProfileRequest = z.infer<typeof updateMyProfileSchema>;

export class UpdateMyProfileDto {
  @ApiProperty({ type: String, example: "Platform Owner" })
  displayName!: string;
}

export class MeUserDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  authUserId!: string;

  @ApiProperty({ type: String, format: "email" })
  email!: string;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ enum: ["active"] })
  status!: "active";
}

export class MeTenantDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ enum: ["active"] })
  status!: "active";
}

export class MeMembershipDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["active"] })
  status!: "active";

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: () => MeTenantDto })
  tenant!: MeTenantDto;

  @ApiProperty({ type: [String] })
  roles!: readonly string[];
}

export class MeResponseDto {
  @ApiProperty({ type: () => MeUserDto })
  user!: MeUserDto;

  @ApiProperty({ type: () => [MeMembershipDto] })
  availableMemberships!: readonly MeMembershipDto[];

  @ApiPropertyOptional({ type: () => MeMembershipDto, nullable: true })
  activeMembership!: MeMembershipDto | null;

  @ApiProperty({ type: [String] })
  roles!: readonly string[];

  @ApiProperty({ type: [String] })
  permissions!: readonly string[];

  @ApiProperty({ type: Boolean })
  isPlatformAdmin!: boolean;

  @ApiProperty({ type: String })
  requestId!: string;
}
