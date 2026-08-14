import { z } from "zod";
import type { CreateTenantAdminTaskInput, TaskReviewDetail, TenantAdminTaskOptions } from "@/features/operations/api/operations-api";

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
  status: z.enum(["manager_review", "in_progress", "completed"]),
  submissionStatus: z.enum(["submitted", "returned", "manager_approved", "tenant_approved", "cancelled"]),
});
const managerReviewsResponseSchema = z.object({ tasks: z.array(managerReviewTaskSchema) });
const managerReviewDetailSchema = z.object({
  task: z.object({
    id: z.string(), title: z.string(), description: z.string().nullable(), clientId: z.string(), clientName: z.string(), serviceId: z.string(), serviceName: z.string(), workGroupId: z.string().nullable(), workGroupName: z.string().nullable(), priority: z.enum(["low", "normal", "high", "urgent"]), status: z.enum(["draft", "requested", "open", "assigned", "in_progress", "submitted", "manager_review", "returned", "tenant_approval", "approved", "completed", "cancelled"]), slaStatus: z.enum(["not_started", "running", "met", "near_breach", "breached", "not_applicable"]), plannedDueAt: z.string().nullable(), assigneeCount: z.number(), assignees: z.array(z.object({ id: z.string(), name: z.string() })), latestSubmissionStatus: z.enum(["submitted", "returned", "manager_approved", "tenant_approved", "cancelled"]).nullable(), latestReviewRemarks: z.string().nullable(),
  }),
  comments: z.array(z.object({ id: z.string(), author: z.string(), kind: z.enum(["submission", "review"]), message: z.string(), createdAt: z.string() })),
  workLogs: z.array(z.object({ id: z.string(), employee: z.string(), workedSeconds: z.number(), startedAt: z.string(), endedAt: z.string().nullable() })),
  attachments: z.array(z.object({ id: z.string(), title: z.string(), fileName: z.string(), fileType: z.string(), sizeBytes: z.number(), uploadedBy: z.string(), updatedAt: z.string() })),
});

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

export async function getEmployeeManagerReviewDetail(taskId: string): Promise<TaskReviewDetail> {
  const response = await fetch(`/api/employee/manager/reviews/${encodeURIComponent(taskId)}`, { cache: "no-store" });
  return managerReviewDetailSchema.parse(await parseJsonResponse(response));
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
