import { notFound } from "next/navigation";
import { TenantCreatePageForm } from "@/components/administration/tenant-create-form";
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
      <TenantCreatePageForm />
    </FeatureBoundary>
  );
}
