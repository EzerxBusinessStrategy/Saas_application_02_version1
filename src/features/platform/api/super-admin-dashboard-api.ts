import type {
  SuperAdminDashboardData,
  SuperAdminDashboardFilters,
} from "@/types/platform-overview";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

export async function getSuperAdminDashboard(
  filters: SuperAdminDashboardFilters,
): Promise<SuperAdminDashboardData> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const response = await fetch(`/api/super-admin/dashboard?${query.toString()}`);
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Dashboard could not load.");
  return (await response.json()) as SuperAdminDashboardData;
}
