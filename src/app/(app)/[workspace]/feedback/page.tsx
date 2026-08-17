import { notFound } from "next/navigation";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { ClientTaskFeedbackPage } from "@/components/operations/client-task-feedback-page";
import { EmployeeTaskFeedbackLogPage } from "@/components/operations/employee-feedback-log-page";
import { sectionAccess } from "@/lib/route-access";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";
import type { Workspace } from "@/types/domain";

export default async function FeedbackPage({
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
      {workspace === "client" ? <ClientTaskFeedbackPage /> : <EmployeeTaskFeedbackLogPage />}
    </FeatureBoundary>
  );
}
