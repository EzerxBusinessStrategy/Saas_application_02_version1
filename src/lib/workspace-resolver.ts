import type { Permission, Role, Workspace } from "@/types/domain";
import { rolePermissions } from "@/lib/permissions";

/**
 * Membership data returned by the backend `/me` endpoint.
 * This mirrors the shape of `MeMembershipDto` from the backend.
 */
export type WorkspaceMembership = {
  id: string;
  displayName: string;
  tenant: {
    id: string;
    code: string;
    displayName: string;
  };
  roles: readonly string[];
};

export type ResolvedWorkspace = {
  workspace: Workspace;
  label: string;
  roles: readonly string[];
  tenantId?: string;
  tenantCode?: string;
  tenantDisplayName?: string;
};

/**
 * Maps a set of role codes to the primary workspace they grant access to.
 * Mirrors the backend's `portalRoles` in `request-context-resolver.service.ts`.
 */
const portalRoles: Readonly<Record<Workspace, readonly string[]>> = {
  "super-admin": ["SUPER_ADMIN"],
  admin: ["TENANT_OWNER", "TENANT_ADMIN", "FINANCE_USER", "HR_OPERATIONS_USER"],
  manager: ["MANAGER"],
  employee: ["EMPLOYEE"],
  client: ["CLIENT_USER"],
};

/**
 * Human-readable workspace labels.
 */
const workspaceLabels: Record<Workspace, string> = {
  "super-admin": "Platform Administration",
  admin: "Administration",
  manager: "Manager",
  employee: "Employee",
  client: "Client Portal",
};

/**
 * Derive the primary workspace for a given set of role codes.
 * Returns the first matching workspace in priority order.
 */
export function workspaceForRoles(roles: readonly string[]): Workspace | null {
  if (roles.includes("EMPLOYEE")) return "employee";
  const entries = Object.entries(portalRoles) as [Workspace, readonly string[]][];
  for (const [workspace, allowedRoles] of entries) {
    if (allowedRoles.some((role) => roles.includes(role))) {
      return workspace;
    }
  }
  return null;
}

/**
 * Derive the human-readable role label for display in the workspace selector.
 * Shows the highest-priority role the user holds within the workspace.
 */
function displayRoleLabel(roles: readonly string[]): string {
  const labelMap: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    TENANT_OWNER: "Tenant Owner",
    TENANT_ADMIN: "Tenant Admin",
    FINANCE_USER: "Finance",
    HR_OPERATIONS_USER: "HR Operations",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
    CLIENT_USER: "Client User",
  };
  const labels = roles.map((r) => labelMap[r]).filter(Boolean);
  return labels.join(", ") || "Member";
}

/**
 * Given the `/me` response data, resolve all available workspaces for
 * the authenticated user. This produces the list shown in the workspace
 * selector when a user belongs to multiple workspaces.
 *
 * - Platform admins get a "Platform Administration" entry.
 * - Each tenant membership produces a workspace entry based on the
 *   user's roles within that tenant.
 */
export function resolveWorkspaces({
  isPlatformAdmin,
  roles,
  availableMemberships,
  activeMembership,
}: {
  isPlatformAdmin: boolean;
  roles: readonly string[];
  availableMemberships?: readonly WorkspaceMembership[];
  activeMembership?: any;
}): ResolvedWorkspace[] {
  const workspaces: ResolvedWorkspace[] = [];

  if (isPlatformAdmin && roles.includes("SUPER_ADMIN")) {
    workspaces.push({
      workspace: "super-admin",
      label: workspaceLabels["super-admin"],
      roles: ["SUPER_ADMIN"],
    });
  }

  if (availableMemberships && availableMemberships.length > 0) {
    for (const membership of availableMemberships) {
      const membershipWorkspace = workspaceForRoles(membership.roles);
      if (membershipWorkspace && membershipWorkspace !== "super-admin") {
        workspaces.push({
          workspace: membershipWorkspace,
          label: membership.tenant.displayName,
          roles: membership.roles,
          tenantId: membership.tenant.id,
          tenantCode: membership.tenant.code,
          tenantDisplayName: membership.tenant.displayName,
        });
      }
    }
  }

  // Fallback: If availableMemberships is empty or missing, resolve workspace from roles or activeMembership
  if (workspaces.length === 0 && !isPlatformAdmin) {
    const primaryWorkspace = workspaceForRoles(roles);
    if (primaryWorkspace && primaryWorkspace !== "super-admin") {
      workspaces.push({
        workspace: primaryWorkspace,
        label: activeMembership?.tenant?.displayName || workspaceLabels[primaryWorkspace],
        roles,
        tenantId: activeMembership?.tenant?.id,
        tenantCode: activeMembership?.tenant?.code,
        tenantDisplayName: activeMembership?.tenant?.displayName,
      });
    }
  }

  return workspaces;
}

/**
 * Convenience: if there is exactly one resolved workspace, return it
 * for automatic redirect. Otherwise return null so the workspace
 * selector is shown.
 */
export function autoSelectWorkspace(
  workspaces: readonly ResolvedWorkspace[],
): ResolvedWorkspace | null {
  return workspaces.length === 1 ? workspaces[0] : null;
}

/**
 * Get the human-readable role summary for a resolved workspace entry.
 */
export function workspaceRoleLabel(resolved: ResolvedWorkspace): string {
  return displayRoleLabel(resolved.roles);
}

/**
 * Compute effective permissions for a set of roles.
 * Used to build the User object for workspace sessions.
 */
export function effectivePermissions(roles: readonly string[]): Permission[] {
  const permSet = new Set<Permission>();
  for (const role of roles) {
    const perms = rolePermissions[role as Role];
    if (perms) {
      for (const p of perms) permSet.add(p);
    }
  }
  return [...permSet];
}
