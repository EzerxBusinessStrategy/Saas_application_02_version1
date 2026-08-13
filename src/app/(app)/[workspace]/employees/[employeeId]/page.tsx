import { notFound } from "next/navigation";
import { EmployeeProfile } from "@/components/tenant-administration/workforce-administration";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ workspace: string; employeeId: string }>;
}) {
  const { workspace, employeeId } = await params;
  if (workspace !== "admin") notFound();
  const user = await getAuthenticatedWorkspaceUser("admin");
  return (
    <FeatureBoundary role={user.role} permissions={["employee.read"]}>
      <EmployeeProfile employeeId={employeeId} />
    </FeatureBoundary>
  );
}
