import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { demoSessionCookie, isWorkspaceAllowed, roleFromSession } from "@/lib/demo-auth";
import { workspaceConfig, workspaces } from "@/mocks/workspaces";
import type { Workspace } from "@/types/domain";
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (!workspaces.includes(workspace as Workspace)) notFound();
  const sessionRole = roleFromSession(
    (await cookies()).get(demoSessionCookie)?.value,
  );
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
