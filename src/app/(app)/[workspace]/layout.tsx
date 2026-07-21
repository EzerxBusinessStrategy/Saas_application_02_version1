import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
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
  const config = workspaceConfig(workspace as Workspace);
  return (
    <WorkspaceShell workspace={workspace as Workspace} user={config.user}>
      {children}
    </WorkspaceShell>
  );
}
