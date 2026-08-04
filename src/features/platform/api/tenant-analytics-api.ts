import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import type { TenantAnalytics, TenantAnalyticsFilters } from "@/types/tenant-analytics";

export async function getTenantAnalytics(filters: TenantAnalyticsFilters): Promise<TenantAnalytics> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const response = await fetch(`/api/super-admin/tenant-analytics?${query}`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Tenant analytics could not load.");
  return response.json() as Promise<TenantAnalytics>;
}
