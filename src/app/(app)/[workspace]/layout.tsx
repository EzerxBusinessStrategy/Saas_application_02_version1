import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { demoSessionCookie, isWorkspaceAllowed, roleFromSession } from "@/lib/demo-auth";
import { authenticatedWorkspaceCookie, superAdminAccessTokenCookie, superAdminRefreshTokenCookie } from "@/lib/auth-cookies";
import {
  fetchVerifiedClientPortalMe,
  fetchVerifiedEmployeeMe,
  fetchVerifiedSuperAdminMe,
  fetchVerifiedTenantAdminMe,
  userFromClientPortalMe,
  userFromEmployeeMe,
  userFromSuperAdminMe,
  userFromTenantAdminMe,
} from "@/lib/server/super-admin-auth";
import { workspaceConfig, workspaces } from "@/mocks/workspaces";
import { defaultLocale } from "@/i18n/config";
import { getMessagesForLocale } from "@/i18n/messages";
import type { Workspace } from "@/types/domain";

export const dynamic = "force-dynamic";

function WorkspaceIntlShell({
  children,
  user,
  workspace,
}: {
  children: React.ReactNode;
  user: Parameters<typeof WorkspaceShell>[0]["user"];
  workspace: Workspace;
}) {
  const locale = user.preferences?.locale ?? defaultLocale;
  return (
    <NextIntlClientProvider locale={locale} messages={getMessagesForLocale(locale)}>
      <WorkspaceShell workspace={workspace} user={user}>{children}</WorkspaceShell>
    </NextIntlClientProvider>
  );
}

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (workspace === "manager") redirect("/employee");
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
      <WorkspaceIntlShell workspace="super-admin" user={userFromSuperAdminMe(me)}>{children}</WorkspaceIntlShell>
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
    return <WorkspaceIntlShell workspace="admin" user={userFromTenantAdminMe(me)}>{children}</WorkspaceIntlShell>;
  }

  if (workspace === "client" && cookieStore.get(authenticatedWorkspaceCookie)?.value === "client") {
    const accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;
    const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
    if (!accessToken) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }
    const me = await fetchVerifiedClientPortalMe(accessToken);
    if (!me) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }
    return <WorkspaceIntlShell workspace="client" user={userFromClientPortalMe(me)}>{children}</WorkspaceIntlShell>;
  }

  if (workspace === "employee" && cookieStore.get(authenticatedWorkspaceCookie)?.value === "employee") {
    const accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;
    const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
    if (!accessToken) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }
    const me = await fetchVerifiedEmployeeMe(accessToken);
    if (!me) {
      if (refreshToken) redirect(`/api/demo-auth/refresh?next=/${workspace}`);
      redirect("/login");
    }
    return <WorkspaceIntlShell workspace="employee" user={userFromEmployeeMe(me)}>{children}</WorkspaceIntlShell>;
  }

  const sessionRole = roleFromSession(cookieStore.get(demoSessionCookie)?.value);
  if (!sessionRole) redirect("/login");
  if (!isWorkspaceAllowed(sessionRole, workspace as Workspace)) {
    redirect("/no-permission");
  }
  const config = workspaceConfig(workspace as Workspace);
  return (
    <WorkspaceIntlShell workspace={workspace as Workspace} user={config.user}>{children}</WorkspaceIntlShell>
  );
}
