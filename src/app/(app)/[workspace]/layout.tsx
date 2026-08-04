import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { demoSessionCookie, isWorkspaceAllowed, roleFromSession } from "@/lib/demo-auth";
import { authenticatedWorkspaceCookie, superAdminAccessTokenCookie, superAdminRefreshTokenCookie } from "@/lib/auth-cookies";
import { fetchVerifiedSuperAdminMe, fetchVerifiedTenantAdminMe, userFromSuperAdminMe, userFromTenantAdminMe } from "@/lib/server/super-admin-auth";
import { workspaceConfig, workspaces } from "@/mocks/workspaces";
import type { Workspace } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (!workspaces.includes(workspace as Workspace)) notFound();
  const cookieStore = await cookies();
  if (workspace === "super-admin") {
    const accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;
    const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
    if (!accessToken) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }
    const me = await fetchVerifiedSuperAdminMe(accessToken);
    if (!me) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }

    return (
      <WorkspaceShell workspace="super-admin" user={userFromSuperAdminMe(me)}>
        {children}
      </WorkspaceShell>
    );
  }

  if (workspace === "admin" && cookieStore.get(authenticatedWorkspaceCookie)?.value === "admin") {
    const accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;
    const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
    if (!accessToken) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }
    const me = await fetchVerifiedTenantAdminMe(accessToken);
    if (!me) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }
    return <WorkspaceShell workspace="admin" user={userFromTenantAdminMe(me)}>{children}</WorkspaceShell>;
  }

  const sessionRole = roleFromSession(cookieStore.get(demoSessionCookie)?.value);
  if (!sessionRole) redirect("/login");
  if (!isWorkspaceAllowed(sessionRole, workspace as Workspace)) {
    redirect("/no-permission");
  }
  const config = workspaceConfig(workspace as Workspace);
  return (
    <WorkspaceShell workspace={workspace as Workspace} user={config.user}>
      {children}
    </WorkspaceShell>
  );
}
