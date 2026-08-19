import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import { appLocales, appTimezones } from "./user-preferences.types";

export const updateMyProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
});

export type UpdateMyProfileRequest = z.infer<typeof updateMyProfileSchema>;

export const updateMyPreferencesSchema = z.object({
  locale: z.enum(appLocales),
  timezone: z.enum(appTimezones),
});

export type UpdateMyPreferencesRequest = z.infer<typeof updateMyPreferencesSchema>;

export const updateMyAvatarSchema = z.object({
  contentType: z.literal("image/webp"),
  data: z.string().min(24).max(1_400_000),
});

export type UpdateMyAvatarRequest = z.infer<typeof updateMyAvatarSchema>;

export class UpdateMyAvatarDto {
  @ApiProperty({ enum: ["image/webp"] })
  contentType!: "image/webp";

  @ApiProperty({ type: String, description: "Base64-encoded 512x512 WebP image." })
  data!: string;
}

export class UpdateMyProfileDto {
  @ApiProperty({ type: String, example: "Platform Owner" })
  displayName!: string;
}

export class UpdateMyPreferencesDto {
  @ApiProperty({ enum: appLocales })
  locale!: UpdateMyPreferencesRequest["locale"];

  @ApiProperty({ enum: appTimezones })
  timezone!: UpdateMyPreferencesRequest["timezone"];
}

export class UserPreferencesDto {
  @ApiProperty({ enum: appLocales })
  locale!: UpdateMyPreferencesRequest["locale"];

  @ApiProperty({ enum: appTimezones })
  timezone!: UpdateMyPreferencesRequest["timezone"];
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

  @ApiPropertyOptional({ type: String, nullable: true })
  avatarUrl!: string | null;
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

  @ApiProperty({ type: () => UserPreferencesDto })
  preferences!: UserPreferencesDto;

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
