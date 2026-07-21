import { notFound } from "next/navigation";
import { EmployeeProfile } from "@/components/tenant-administration/workforce-administration";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { workspaceConfig } from "@/mocks/workspaces";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ workspace: string; employeeId: string }>;
}) {
  const { workspace, employeeId } = await params;
  if (workspace !== "admin") notFound();
  const user = workspaceConfig("admin").user;
  return (
    <FeatureBoundary role={user.role} permissions={["employee.read"]}>
      <EmployeeProfile employeeId={employeeId} />
    </FeatureBoundary>
  );
}
