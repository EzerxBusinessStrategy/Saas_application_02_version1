import { notFound } from "next/navigation";
import { CompletedTasksPage } from "@/components/tenant-administration/completed-tasks-page";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { sectionAccess } from "@/lib/route-access";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";
import type { Workspace } from "@/types/domain";

export default async function CompletedTasks({
  params,
}: {
  params: Promise<{ workspace: Workspace }>;
}) {
  const { workspace } = await params;
  const access = sectionAccess["completed-tasks"];
  if (!access.workspaces.includes(workspace)) notFound();
  const user = await getAuthenticatedWorkspaceUser(workspace);

  return (
    <FeatureBoundary role={user.role} permissions={access.permissions ?? []}>
      <CompletedTasksPage />
    </FeatureBoundary>
  );
}
