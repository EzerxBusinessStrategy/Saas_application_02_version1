import { Inject, Injectable } from "@nestjs/common";
import { AuthContextRepository, AuthContextRow } from "./auth-context.repository";
import { applicationUserNotFound, forbiddenPortal } from "./auth-errors";
import { MeMembershipDto, MeResponseDto } from "./me.dto";
import { RequestContext } from "./request-context";

@Injectable()
export class MeService {
  constructor(@Inject(AuthContextRepository) private readonly repository: AuthContextRepository) {}

  async getMe(context: RequestContext): Promise<MeResponseDto> {
    const rows = await this.repository.findBySupabaseAuthUserId(context.authUserId);
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

    return {
      user: {
        id: userRow.user_id,
        authUserId: context.authUserId,
        email: userRow.user_email,
        displayName: userRow.user_display_name,
        status: "active",
      },
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

  async updateProfile(context: RequestContext, displayName: string): Promise<MeResponseDto> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) {
      throw forbiddenPortal();
    }
    const updated = await this.repository.updateDisplayName(context.userId, displayName);
    if (!updated) throw applicationUserNotFound();
    return this.getMe(context);
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
