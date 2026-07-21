import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/tenant-administration/client-management";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { workspaceConfig } from "@/mocks/workspaces";

export default async function ClientDetailsPage({
  params,
}: {
  params: Promise<{ workspace: string; clientId: string }>;
}) {
  const { workspace, clientId } = await params;
  if (workspace !== "admin") notFound();
  const user = workspaceConfig("admin").user;
  return (
    <FeatureBoundary role={user.role} permissions={["client.read"]}>
      <ClientDetail clientId={clientId} />
    </FeatureBoundary>
  );
}
