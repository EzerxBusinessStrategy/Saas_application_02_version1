import { Dashboard } from "@/components/dashboard/dashboard";
import type { Workspace } from "@/types/domain";
export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ workspace: Workspace }>;
}) {
  const { workspace } = await params;
  return <Dashboard workspace={workspace} />;
}
