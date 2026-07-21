import { notFound } from "next/navigation";
import { TasksPage } from "@/components/operations/tasks-page";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { hasPermission } from "@/lib/permissions";
import { sectionAccess } from "@/lib/route-access";
import { workspaceConfig } from "@/mocks/workspaces";
import type { Workspace } from "@/types/domain";

export default async function Tasks({
  params,
}: {
  params: Promise<{ workspace: Workspace }>;
}) {
  const { workspace } = await params;
  const access = sectionAccess.tasks;
  if (!access.workspaces.includes(workspace)) notFound();
  const user = workspaceConfig(workspace).user;
  return (
    <FeatureBoundary role={user.role} permissions={access.permissions ?? []}>
      <TasksPage
        workspace={workspace}
        canCreate={hasPermission(user.role, "task.create")}
        canUpdate={
          hasPermission(user.role, "task.update_status.assigned") ||
          hasPermission(user.role, "task.create")
        }
      />
    </FeatureBoundary>
  );
}
