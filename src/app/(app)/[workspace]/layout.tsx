import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { clientSessionCookie, employeeSessionCookie, superAdminSessionCookie, tenantSessionCookie } from "@/lib/auth-cookies";
import { workspaceConfig, workspaces } from "@/mocks/workspaces";
import { defaultLocale } from "@/i18n/config";
import { getMessagesForLocale } from "@/i18n/messages";
import type { Workspace } from "@/types/domain";

export const dynamic = "force-dynamic";

const loginForWorkspace: Record<Workspace, string> = { "super-admin": "/super-admin/login", admin: "/admin/login", employee: "/employee/login", client: "/client/login", manager: "/employee/login" };
const cookieForWorkspace: Record<Workspace, string> = { "super-admin": superAdminSessionCookie, admin: tenantSessionCookie, employee: employeeSessionCookie, client: clientSessionCookie, manager: employeeSessionCookie };

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ workspace: string }> }) {
  const { workspace: rawWorkspace } = await params;
  if (rawWorkspace === "manager") redirect("/employee");
  if (!workspaces.includes(rawWorkspace as Workspace)) notFound();
  const workspace = rawWorkspace as Workspace;
  if (!(await cookies()).get(cookieForWorkspace[workspace])?.value) redirect(loginForWorkspace[workspace]);
  const user = workspaceConfig(workspace).user;
  const locale = user.preferences?.locale ?? defaultLocale;
  return <NextIntlClientProvider locale={locale} messages={getMessagesForLocale(locale)}><WorkspaceShell workspace={workspace} user={user}>{children}</WorkspaceShell></NextIntlClientProvider>;
}
