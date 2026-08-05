import { Inject, Injectable } from "@nestjs/common";
import {
  applicationUserNotFound,
  ambiguousTenantMembership,
  forbiddenPortal,
  inactiveMembership,
  invalidTenantSelection,
  missingMembership,
  roleNotAssigned,
  tenantSuspended,
  userSuspended,
} from "./auth-errors";
import { AuthContextRepository, AuthContextRow } from "./auth-context.repository";
import { freezeRequestContext, RequestContext, TenantSelectionInput, VerifiedAuthUser } from "./request-context";

const portalRoles: Readonly<Record<string, readonly string[]>> = {
  "super-admin": ["SUPER_ADMIN"],
  admin: ["TENANT_OWNER", "TENANT_ADMIN", "FINANCE_USER", "HR_OPERATIONS_USER", "SUPER_ADMIN"],
  manager: ["MANAGER", "SUPER_ADMIN"],
  employee: ["EMPLOYEE", "SUPER_ADMIN"],
  client: ["CLIENT_USER"],
};

@Injectable()
export class RequestContextResolver {
  constructor(@Inject(AuthContextRepository) private readonly repository: AuthContextRepository) {}

  async resolve(
    verifiedUser: VerifiedAuthUser,
    selection: TenantSelectionInput,
    requestId: string,
  ): Promise<{
    readonly context: RequestContext;
    readonly memberships: readonly AuthContextRow[];
  }> {
    const rows = await this.repository.findBySupabaseAuthUserId(verifiedUser.authUserId);
    if (rows.length === 0) throw applicationUserNotFound();
    const first = rows[0];
    if (first.user_status !== "active") throw userSuspended();

    const memberships = rows.filter((row) => row.membership_id);
    const platformRow = rows.find((row) => isPlatformRow(row));
    const selectedPlatform = selectPlatformRow(platformRow, selection);
    if (selectedPlatform) {
      const roles = [...selectedPlatform.role_codes];
      if (selection.selectedRole && !roles.includes(selection.selectedRole)) {
        throw roleNotAssigned();
      }
      if (selection.portal && !isPortalAllowed(selection.portal, roles)) {
        throw forbiddenPortal();
      }

      return {
        context: freezeRequestContext({
          requestId,
          authUserId: verifiedUser.authUserId,
          userId: first.user_id,
          roles,
          permissions: [...selectedPlatform.permission_codes],
          isPlatformAdmin: roles.includes("SUPER_ADMIN"),
        }),
        memberships,
      };
    }

    if (memberships.length === 0) throw missingMembership();

    const selected = selectMembership(memberships, selection);
    if (!selected) throw invalidTenantSelection();
    if (selected.tenant_status !== "active") throw tenantSuspended();
    if (selected.membership_status !== "active") throw inactiveMembership();

    const roles = [...selected.role_codes];
    if (selection.selectedRole && !roles.includes(selection.selectedRole)) {
      throw roleNotAssigned();
    }
    if (selection.portal && !isPortalAllowed(selection.portal, roles)) {
      throw forbiddenPortal();
    }
    if (!selected.tenant_id || !selected.membership_id) throw missingMembership();

    return {
      context: freezeRequestContext({
        requestId,
        authUserId: verifiedUser.authUserId,
        userId: first.user_id,
        tenantId: selected.tenant_id,
        membershipId: selected.membership_id,
        roles,
        permissions: [...selected.permission_codes],
        isPlatformAdmin: roles.includes("SUPER_ADMIN"),
      }),
      memberships,
    };
  }
}

function selectMembership(
  memberships: readonly AuthContextRow[],
  selection: TenantSelectionInput,
): AuthContextRow | undefined {
  if (selection.tenantId) {
    return memberships.find((row) => row.tenant_id === selection.tenantId);
  }
  if (selection.tenantCode) {
    return memberships.find((row) => row.tenant_code === selection.tenantCode);
  }
  const active = memberships.filter(
    (row) => row.tenant_status === "active" && row.membership_status === "active",
  );
  if (active.length === 1) return active[0];
  if (active.length > 1) throw ambiguousTenantMembership();
  return undefined;
}

function selectPlatformRow(
  platformRow: AuthContextRow | undefined,
  selection: TenantSelectionInput,
): AuthContextRow | undefined {
  if (!platformRow) return undefined;
  if (selection.tenantId || selection.tenantCode) return undefined;
  if (selection.portal && !["super-admin", "admin"].includes(selection.portal)) return undefined;
  return platformRow;
}

function isPlatformRow(row: AuthContextRow): boolean {
  return !row.tenant_id && !row.membership_id && row.role_codes.includes("SUPER_ADMIN");
}

function isPortalAllowed(portal: string, roles: readonly string[]): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;
  const allowedRoles = portalRoles[portal];
  return Boolean(allowedRoles?.some((role) => roles.includes(role)));
}
