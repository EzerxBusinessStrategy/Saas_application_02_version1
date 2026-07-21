import { notFound } from "next/navigation";
import { TenantDetail } from "@/components/administration/tenant-management";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { workspaceConfig } from "@/mocks/workspaces";

export default async function TenantDetailsPage({
  params,
}: {
  params: Promise<{ workspace: string; tenantId: string }>;
}) {
  const { workspace, tenantId } = await params;
  if (workspace !== "super-admin") notFound();
  const user = workspaceConfig("super-admin").user;
  return (
    <FeatureBoundary role={user.role} permissions={["tenant.read"]}>
      <TenantDetail tenantId={tenantId} />
    </FeatureBoundary>
  );
}
