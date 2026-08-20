import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuthContextRepository, AuthContextRow } from "./auth-context.repository";
import { forbiddenPortal } from "./auth-errors";
import { MeContextDto, MeMembershipDto, MeResponseDto } from "./me.dto";
import { RequestContext } from "./request-context";
import { UserAvatarRepository } from "./user-avatar.repository";
import { UserAvatarStorageService } from "./user-avatar-storage.service";
import { avatarObjectKey, isWebpImage, MAX_AVATAR_BYTES } from "./user-avatar.util";
import { UserPreferencesRepository } from "./user-preferences.repository";
import { UserPreferences } from "./user-preferences.types";

@Injectable()
export class MeService {
  constructor(
    @Inject(AuthContextRepository) private readonly repository: AuthContextRepository,
    @Inject(UserPreferencesRepository) private readonly userPreferencesRepository: UserPreferencesRepository,
    @Inject(UserAvatarRepository) private readonly userAvatarRepository: UserAvatarRepository,
    @Inject(UserAvatarStorageService) private readonly userAvatarStorage: UserAvatarStorageService,
  ) {}

  async getMe(context: RequestContext): Promise<MeResponseDto> {
    const rows = await this.repository.findByApplicationUserId(context.userId);
    const userRow = rows[0];
    if (!userRow) {
      throw new Error("Resolved request context no longer matches user data.");
    }
    const active = context.membershipId
      ? rows.find((row) => row.membership_id === context.membershipId)
      : undefined;
    if (context.membershipId && (!active || !active.tenant_id || !active.membership_id)) {
      throw new Error("Resolved request context no longer matches membership data.");
    }
    const [preferences, avatarUrl, phone] = await Promise.all([
      this.userPreferencesRepository.getOrCreate(context),
      this.signedAvatarUrl(context),
      this.repository.getUserPhone(context.userId),
    ]);

    return {
      user: {
        id: userRow.user_id,
        authUserId: context.authUserId,
        email: userRow.user_email,
        displayName: userRow.user_display_name,
        status: "active",
        avatarUrl,
        phone,
      },
      preferences,
      availableMemberships: rows
        .filter((row) => row.membership_id && row.tenant_id)
        .map((row) => membershipDto(row as typeof row & { tenant_id: string; membership_id: string })),
      activeMembership:
        active && active.tenant_id && active.membership_id
          ? membershipDto(active as typeof active & { tenant_id: string; membership_id: string })
          : null,
      roles: context.roles,
      permissions: context.permissions,
      isPlatformAdmin: context.isPlatformAdmin,
      requestId: context.requestId,
    };
  }

  async updateProfile(
    context: RequestContext,
    input: { displayName: string; phone?: string; displayTitle?: string; membershipId?: string },
  ): Promise<MeResponseDto> {
    if (!context.isPlatformAdmin) {
      throw forbiddenPortal();
    }
    await this.repository.updateOwnProfile(context, input.displayName, input.phone);
    if (input.membershipId !== undefined) {
      await this.repository.updateOwnMembershipDisplayTitle(
        context,
        input.membershipId,
        input.displayTitle ?? "",
      );
    }
    return this.getMe(context);
  }

  async listContexts(context: RequestContext): Promise<{ contexts: readonly MeContextDto[] }> {
    const rows = await this.repository.listCurrentUserContexts(context);
    return {
      contexts: rows.map((row) => {
        if (row.context_type === "platform") {
          return {
            type: "platform",
            label: "Platform Admin",
            roles: row.roles,
          };
        }
        return {
          type: "tenant",
          tenantId: row.tenant_id ?? undefined,
          tenantName: row.tenant_name ?? undefined,
          membershipId: row.membership_id ?? undefined,
          roles: row.roles,
          displayTitle: row.display_title,
          hasEmployee: row.has_employee,
        };
      }),
    };
  }

  async updateAvatar(context: RequestContext, data: string): Promise<MeResponseDto> {
    const bytes = decodeAvatarPayload(data);
    const objectKey = avatarObjectKey({
      tenantId: context.tenantId,
      userId: context.userId,
      objectId: randomUUID(),
    });
    await this.userAvatarStorage.uploadWebp(objectKey, bytes);
    let previousPath: string | null = null;
    try {
      previousPath = await this.userAvatarRepository.replacePath(context, objectKey);
    } catch (error) {
      await this.userAvatarStorage.removeObject(objectKey);
      throw error;
    }
    if (previousPath && previousPath !== objectKey) {
      try {
        await this.userAvatarStorage.removeObject(previousPath);
      } catch {
        return this.getMe(context);
      }
    }
    return this.getMe(context);
  }

  async removeAvatar(context: RequestContext): Promise<MeResponseDto> {
    const previousPath = await this.userAvatarRepository.replacePath(context, null);
    if (previousPath) {
      await this.userAvatarStorage.removeObject(previousPath);
    }
    return this.getMe(context);
  }

  async updatePreferences(
    context: RequestContext,
    preferences: UserPreferences,
  ): Promise<{ preferences: UserPreferences }> {
    return { preferences: await this.userPreferencesRepository.update(context, preferences) };
  }

  private async signedAvatarUrl(context: RequestContext): Promise<string | null> {
    const path = await this.userAvatarRepository.getPath(context);
    if (!path) return null;
    try {
      return await this.userAvatarStorage.createSignedUrl(path, context.userId);
    } catch {
      return null;
    }
  }
}

function membershipDto(
  row: AuthContextRow & { tenant_id: string; membership_id: string },
): MeMembershipDto {
  assertMembershipRow(row);
  return {
    id: row.membership_id,
    status: "active",
    displayName: row.membership_display_name,
    timezone: row.membership_timezone,
    tenant: {
      id: row.tenant_id,
      code: row.tenant_code,
      displayName: row.tenant_display_name,
      status: "active",
    },
    roles: row.role_codes,
  };
}

function assertMembershipRow(row: {
  readonly tenant_code: string | null;
  readonly tenant_display_name: string | null;
  readonly membership_display_name: string | null;
  readonly membership_timezone: string | null;
}): asserts row is {
  readonly tenant_code: string;
  readonly tenant_display_name: string;
  readonly membership_display_name: string;
  readonly membership_timezone: string;
} {
  if (
    !row.tenant_code ||
    !row.tenant_display_name ||
    !row.membership_display_name ||
    !row.membership_timezone
  ) {
    throw new Error("Resolved membership is missing safe response fields.");
  }
}

function decodeAvatarPayload(data: string): Uint8Array {
  const normalized = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(normalized, "base64"));
  } catch {
    throw new BadRequestException({
      code: "AVATAR_TYPE_INVALID",
      message: "The profile photo could not be read.",
    });
  }
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_AVATAR_BYTES || !isWebpImage(bytes)) {
    throw new BadRequestException({
      code: "AVATAR_TYPE_INVALID",
      message: "Export a square WebP profile photo and try again.",
    });
  }
  return bytes;
}
