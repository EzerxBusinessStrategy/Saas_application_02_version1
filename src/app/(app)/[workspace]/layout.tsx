import { NextIntlClientProvider } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";
import { normalizeAppWorkspace } from "@/lib/workspace-routing";
import { defaultLocale } from "@/i18n/config";
import { getMessagesForLocale } from "@/i18n/messages";
import type { Workspace } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ workspace: string }> }) {
  const { workspace: rawWorkspace } = await params;
  if (rawWorkspace === "manager") redirect("/employee");
  const workspace = normalizeAppWorkspace(rawWorkspace);
  if (!workspace) notFound();
  const user = await getAuthenticatedWorkspaceUser(workspace);
  const locale = user.preferences?.locale ?? defaultLocale;
  return <NextIntlClientProvider locale={locale} messages={getMessagesForLocale(locale)}><WorkspaceShell workspace={workspace} user={user}>{children}</WorkspaceShell></NextIntlClientProvider>;
}
