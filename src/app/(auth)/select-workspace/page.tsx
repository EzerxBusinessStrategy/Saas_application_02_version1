import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  superAdminAccessTokenCookie,
  superAdminRefreshTokenCookie,
} from "@/lib/auth-cookies";
import {
  fetchVerifiedSuperAdminMe,
  fetchVerifiedTenantAdminMe,
} from "@/lib/server/super-admin-auth";
import { resolveWorkspaces, autoSelectWorkspace } from "@/lib/workspace-resolver";
import { WorkspaceSelector } from "@/components/auth/workspace-selector";
import type { ResolvedWorkspace, WorkspaceMembership } from "@/lib/workspace-resolver";

export const dynamic = "force-dynamic";

export default async function SelectWorkspacePage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;
  const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;

  if (!accessToken) {
    if (refreshToken) {
      redirect("/api/demo-auth/refresh?next=/select-workspace");
    }
    redirect("/login");
  }

  // Gather all context the user can access
  let displayName = "";
  let isPlatformAdmin = false;
  const roles: string[] = [];
  const memberships: WorkspaceMembership[] = [];

  // Check super-admin access
  const superAdminMe = await fetchVerifiedSuperAdminMe(accessToken);
  if (superAdminMe) {
    isPlatformAdmin = true;
    roles.push(...superAdminMe.roles);
    displayName = superAdminMe.user.displayName;
  }

  // Check tenant admin access
  const tenantAdminMe = await fetchVerifiedTenantAdminMe(accessToken);
  if (tenantAdminMe) {
    if (!displayName) {
      displayName = tenantAdminMe.user.displayName;
    }
    roles.push(
      ...tenantAdminMe.roles.filter((r: string) => !roles.includes(r)),
    );
    // If there's an active membership, add it
    if (tenantAdminMe.activeMembership) {
      const membership = tenantAdminMe.activeMembership as WorkspaceMembership;
      if (membership.tenant) {
        memberships.push(membership);
      }
    }
  }

  const workspaces = resolveWorkspaces({
    isPlatformAdmin,
    roles,
    availableMemberships: memberships,
  });

  // If only one workspace, redirect automatically
  const single = autoSelectWorkspace(workspaces);
  if (single) {
    redirect(`/${single.workspace}`);
  }

  // If no workspaces, send to login
  if (workspaces.length === 0) {
    redirect("/login");
  }

  return (
    <WorkspaceSelector
      workspaces={workspaces}
      displayName={displayName || undefined}
    />
  );
}
