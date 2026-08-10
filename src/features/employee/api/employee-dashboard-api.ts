import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const employeeDashboardSchema = z.object({
  employeeName: z.string(),
  today: z.string().datetime(),
  summary: z.object({
    dueToday: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    needsChanges: z.number().int().nonnegative(),
  }),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      clientName: z.string(),
      serviceName: z.string(),
      description: z.string().nullable(),
      status: z.string(),
      statusLabel: z.string(),
      plannedDueAt: z.string().datetime().nullable(),
      dueToday: z.boolean(),
      actionLabel: z.string(),
      needsChanges: z.boolean(),
      latestManagerNote: z.string().nullable(),
    }),
  ),
  workLog: z.object({
    loggedMinutes: z.number().int().nonnegative(),
    status: z.enum(["not_started", "draft", "submitted", "reviewed"]),
  }),
});

export type EmployeeDashboard = z.infer<typeof employeeDashboardSchema>;

export async function getEmployeeDashboard(): Promise<EmployeeDashboard> {
  const response = await fetch("/api/employee/dashboard", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Employee dashboard could not load.",
    );
  }
  return employeeDashboardSchema.parse(body);
}
