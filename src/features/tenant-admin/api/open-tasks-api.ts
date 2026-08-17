import { z } from "zod";

const openTaskAssigneeSchema = z.object({
  id: z.string(),
  name: z.string(),
  assignedAt: z.string(),
});

const openTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  clientId: z.string(),
  clientName: z.string(),
  clientPublicIp: z.string().nullable(),
  serviceId: z.string(),
  serviceName: z.string(),
  workGroupId: z.string().nullable(),
  workGroupName: z.string().nullable(),
  priority: z.string(),
  status: z.string(),
  slaStatus: z.string(),
  plannedDueAt: z.string().nullable(),
  createdAt: z.string(),
  assignedAt: z.string().nullable(),
  completedAt: z.string().nullable().optional(),
  assignees: z.array(openTaskAssigneeSchema),
});

const periodTasksResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
    source: z.enum(["query", "financial_year", "last_30_days"]),
  }),
  total: z.number(),
  tasks: z.array(openTaskSchema),
});

export type OpenTaskAssignee = z.infer<typeof openTaskAssigneeSchema>;
export type OpenTask = z.infer<typeof openTaskSchema>;
export type OpenTasksResponse = z.infer<typeof periodTasksResponseSchema>;
export type CompletedTasksResponse = OpenTasksResponse;

async function fetchPeriodTasks(path: string, params?: { from?: string; to?: string }) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";

  const response = await fetch(`${path}${suffix}`, { cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? body?.error?.message ?? "Failed to load tasks.");
  }
  return periodTasksResponseSchema.parse(body);
}

export async function listTenantAdminOpenTasks(params?: {
  from?: string;
  to?: string;
}): Promise<OpenTasksResponse> {
  return fetchPeriodTasks("/api/admin/open-tasks", params);
}

export async function listTenantAdminCompletedTasks(params?: {
  from?: string;
  to?: string;
}): Promise<CompletedTasksResponse> {
  return fetchPeriodTasks("/api/admin/completed-tasks", params);
}
