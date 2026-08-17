import { notFound } from "next/navigation";
import { TenantTaskReviewPage } from "@/components/operations/tenant-task-review-page";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { sectionAccess } from "@/lib/route-access";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";
import type { Workspace } from "@/types/domain";

export default async function TenantTaskReview({
  params,
}: {
  params: Promise<{ workspace: Workspace }>;
}) {
  const { workspace } = await params;
  const access = sectionAccess["task-review"];
  if (!access.workspaces.includes(workspace)) notFound();
  const user = await getAuthenticatedWorkspaceUser(workspace);

  return (
    <FeatureBoundary role={user.role} permissions={access.permissions ?? []}>
      <TenantTaskReviewPage />
    </FeatureBoundary>
  );
}
