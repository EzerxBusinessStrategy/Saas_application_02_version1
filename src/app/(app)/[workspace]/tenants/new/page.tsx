import { notFound } from "next/navigation";
import { TenantCreatePageForm } from "@/components/administration/tenant-create-form";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";

export default async function NewTenantPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (workspace !== "super-admin") notFound();
  const user = await getAuthenticatedWorkspaceUser("super-admin");
  return (
    <FeatureBoundary role={user.role} permissions={["tenant.create"]}>
      <TenantCreatePageForm />
    </FeatureBoundary>
  );
}
