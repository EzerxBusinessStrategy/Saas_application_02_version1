import { notFound } from "next/navigation";
import { TenantCreateForm } from "@/components/administration/tenant-management";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { workspaceConfig } from "@/mocks/workspaces";

export default async function NewTenantPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (workspace !== "super-admin") notFound();
  const user = workspaceConfig("super-admin").user;
  return (
    <FeatureBoundary role={user.role} permissions={["tenant.create"]}>
      <TenantCreateForm />
    </FeatureBoundary>
  );
}
