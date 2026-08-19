import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const assigneeSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  plannedDueAt: z.string(),
  serviceId: z.string().optional().default(""),
  serviceName: z.string(),
  frequency: z.string().nullable().optional().default(null),
  priority: z.string().optional().default("normal"),
  assignees: z.array(assigneeSchema),
});

const responseSchema = z.object({
  period: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  total: z.number(),
  tasks: z.array(taskSchema),
});

export type ClientPortalCalendarTask = z.infer<typeof taskSchema>;
export type ClientPortalTaskCalendarResponse = z.infer<typeof responseSchema>;

export async function getClientPortalTaskCalendar(params: {
  from: string;
  to: string;
}): Promise<ClientPortalTaskCalendarResponse> {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  const response = await fetch(`/api/client-portal/task-calendar?${search.toString()}`, {
    cache: "no-store",
  });
  redirectToLoginOnUnauthorized(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? body?.error?.message ?? "Failed to load task calendar.");
  }
  return responseSchema.parse(body);
}
