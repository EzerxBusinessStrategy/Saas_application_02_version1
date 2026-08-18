import { z } from "zod";

const activityEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  label: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  result: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  actor: z.string(),
  createdAt: z.string(),
});

const activityResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
    source: z.enum(["query", "financial_year", "last_30_days"]),
  }),
  total: z.number(),
  events: z.array(activityEventSchema),
});

export type TenantActivityResponse = z.infer<typeof activityResponseSchema>;

export async function listTenantAdminActivity(params?: {
  from?: string;
  to?: string;
}): Promise<TenantActivityResponse> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";

  const response = await fetch(`/api/admin/activity${suffix}`, { cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? body?.error?.message ?? "Failed to load activity.");
  }
  return activityResponseSchema.parse(body);
}
