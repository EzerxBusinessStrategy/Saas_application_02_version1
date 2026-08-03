import type { SuperAdminSearchResponse } from "@/types/super-admin-search";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

export async function searchSuperAdminRecords(
  {
    query,
    limit = 10,
    scope = "all",
  }: {
    query: string;
    limit?: number;
    scope?: "all" | "tenants";
  },
  signal?: AbortSignal,
): Promise<SuperAdminSearchResponse> {
  const params = new URLSearchParams({ limit: String(limit), scope });
  if (query.trim()) params.set("q", query.trim());

  const response = await fetch(`/api/super-admin/search?${params.toString()}`, {
    signal,
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Search could not load.");
  return (await response.json()) as SuperAdminSearchResponse;
}
