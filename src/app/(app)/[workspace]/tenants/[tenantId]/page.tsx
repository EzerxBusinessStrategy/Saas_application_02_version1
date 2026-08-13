import { notFound } from "next/navigation";
import { TenantDetail } from "@/components/administration/tenant-management";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";

export default async function TenantDetailsPage({
  params,
}: {
  params: Promise<{ workspace: string; tenantId: string }>;
}) {
  const { workspace, tenantId } = await params;
  if (workspace !== "super-admin") notFound();
  const user = await getAuthenticatedWorkspaceUser("super-admin");
  return (
    <FeatureBoundary role={user.role} permissions={["tenant.read"]}>
      <TenantDetail tenantId={tenantId} />
    </FeatureBoundary>
  );
}
