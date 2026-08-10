import { PlatformOverviewDashboard } from "@/components/dashboard/platform-overview-dashboard";
import { TenantAdministrationOverview } from "@/components/tenant-administration/tenant-overview";
import { ClientPortal } from "@/components/operations/client-portal";
import { EmployeeWorkspace } from "@/components/operations/employee-workspace";
import type { Workspace } from "@/types/domain";

export function Dashboard({ workspace }: { workspace: Workspace }) {
  if (workspace === "super-admin") return <PlatformOverviewDashboard />;
  if (workspace === "admin") return <TenantAdministrationOverview />;
  if (workspace === "client") return <ClientPortal />;
  return <EmployeeWorkspace />;
}
