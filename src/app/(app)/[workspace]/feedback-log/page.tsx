import { notFound } from "next/navigation";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { TenantTaskFeedbackLogPage } from "@/components/tenant-administration/task-feedback-log-page";
import { sectionAccess } from "@/lib/route-access";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";
import type { Workspace } from "@/types/domain";

export default async function FeedbackLogPage({
  params,
}: {
  params: Promise<{ workspace: Workspace }>;
}) {
  const { workspace } = await params;
  const access = sectionAccess["feedback-log"];
  if (!access.workspaces.includes(workspace)) notFound();
  const user = await getAuthenticatedWorkspaceUser(workspace);

  return (
    <FeatureBoundary role={user.role} permissions={access.permissions ?? []}>
      <TenantTaskFeedbackLogPage />
    </FeatureBoundary>
  );
}
