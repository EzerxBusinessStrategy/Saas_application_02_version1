import { notFound } from "next/navigation";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { EmployeeTaskFeedbackLogPage } from "@/components/operations/employee-feedback-log-page";
import { sectionAccess } from "@/lib/route-access";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";
import type { Workspace } from "@/types/domain";

export default async function EmployeeFeedbackPage({
  params,
}: {
  params: Promise<{ workspace: Workspace }>;
}) {
  const { workspace } = await params;
  const access = sectionAccess.feedback;
  if (!access.workspaces.includes(workspace)) notFound();
  const user = await getAuthenticatedWorkspaceUser(workspace);

  return (
    <FeatureBoundary role={user.role} permissions={access.permissions ?? []}>
      <EmployeeTaskFeedbackLogPage />
    </FeatureBoundary>
  );
}
