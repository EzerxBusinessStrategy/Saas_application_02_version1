import { z } from "zod";
import type { CreateTenantAdminTaskInput, TenantAdminTaskOptions } from "@/features/operations/api/operations-api";

const managerClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  openTasks: z.number(),
});
const managerClientsResponseSchema = z.object({ clients: z.array(managerClientSchema) });
const managerReviewTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  clientName: z.string(),
  employeeName: z.string(),
  submittedAt: z.string(),
  workedSeconds: z.number(),
  taskComment: z.string().nullable(),
});
const managerReviewsResponseSchema = z.object({ tasks: z.array(managerReviewTaskSchema) });

export type EmployeeManagerClient = z.infer<typeof managerClientSchema>;
export type EmployeeManagerReviewTask = z.infer<typeof managerReviewTaskSchema>;

export async function listEmployeeManagerClients(): Promise<EmployeeManagerClient[]> {
  const response = await fetch("/api/employee/manager/clients", { cache: "no-store" });
  return managerClientsResponseSchema.parse(await parseJsonResponse(response)).clients;
}

export async function getEmployeeManagerTaskOptions(): Promise<TenantAdminTaskOptions> {
  const response = await fetch("/api/employee/manager/task-options", { cache: "no-store" });
  return (await parseJsonResponse(response)) as TenantAdminTaskOptions;
}

export async function createEmployeeManagerTask(input: CreateTenantAdminTaskInput) {
  const response = await fetch("/api/employee/manager/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function listEmployeeManagerReviews(): Promise<EmployeeManagerReviewTask[]> {
  const response = await fetch("/api/employee/manager/reviews", { cache: "no-store" });
  return managerReviewsResponseSchema.parse(await parseJsonResponse(response)).tasks;
}

export async function decideEmployeeManagerReview(taskId: string, decision: "approve" | "return", remarks = "") {
  const response = await fetch(`/api/employee/manager/reviews/${encodeURIComponent(taskId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, remarks }),
  });
  return parseJsonResponse(response);
}

async function parseJsonResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? "Request failed.");
  }
  return body;
}
