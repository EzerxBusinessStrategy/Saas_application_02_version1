import { z } from "zod";
import {
  achievementProgress,
  achievements,
  clientRequests,
  gamificationPreferences,
  goalProgress,
  goals,
  invoices,
  milestones,
  operationalDocuments,
  operationalTasks,
  payments,
  recognitions,
  streak,
  teamProgress,
  workLogs,
} from "@/mocks/operations";
import {
  invoiceSchema,
  taskSchema,
  workLogInputSchema,
  workLogSchema,
  type OperationalListRequest,
} from "@/types/operations";
import type { Workspace } from "@/types/domain";

export const progressPercent = (current: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

export const isGamificationVisible = (preferences: {
  enabled: boolean;
  reducedMotion: boolean;
}) => preferences.enabled;

const taskListSchema = z.array(taskSchema);
const employeeId = "emp-riley";
const managerId = "mgr-avery";
const clientId = "northstar";

function scopedTasks(workspace: Workspace) {
  if (workspace === "manager")
    return operationalTasks.filter((task) => task.managerId === managerId);
  if (workspace === "employee")
    return operationalTasks.filter((task) => task.assigneeId === employeeId);
  if (workspace === "client")
    return operationalTasks.filter((task) => task.clientId === clientId);
  return operationalTasks;
}

export async function listOperationalTasks(
  workspace: Workspace,
  request: OperationalListRequest = {},
) {
  const query = request.query?.trim().toLowerCase();
  const items = scopedTasks(workspace).filter(
    (task) =>
      (!query ||
        [
          task.title,
          task.client,
          task.engagement,
          task.workGroup,
          task.assignee,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)) &&
      (!request.status || task.status === request.status) &&
      (!request.priority || task.priority === request.priority) &&
      (!request.client || task.client === request.client) &&
      (!request.assignee || task.assignee === request.assignee) &&
      (!request.manager || task.manager === request.manager) &&
      (!request.engagement || task.engagement === request.engagement) &&
      (!request.workGroup || task.workGroup === request.workGroup) &&
      (!request.sla || task.sla === request.sla) &&
      (!request.due ||
        (request.due === "overdue" && task.dueDate < "2026-07-21") ||
        (request.due === "today" && task.dueDate === "2026-07-21") ||
        (request.due === "upcoming" && task.dueDate > "2026-07-21")),
  );
  return taskListSchema.parse(items);
}

export async function listWorkLogs(workspace: Workspace) {
  const taskIds = new Set(scopedTasks(workspace).map((task) => task.id));
  return z
    .array(workLogSchema)
    .parse(workLogs.filter((log) => taskIds.has(log.taskId)));
}

export async function validateWorkLog(input: unknown) {
  return workLogInputSchema.parse(input);
}

export async function listInvoices(workspace: Workspace) {
  const items =
    workspace === "client"
      ? invoices.filter((invoice) => invoice.clientId === clientId)
      : invoices;
  return z.array(invoiceSchema).parse(items);
}

export async function getOperationalWorkspace(workspace: Workspace) {
  const tasks = await listOperationalTasks(workspace);
  const isClient = workspace === "client";
  return {
    tasks,
    workLogs: await listWorkLogs(workspace),
    invoices: await listInvoices(workspace),
    payments: isClient
      ? payments.filter((payment) => payment.client === "Northstar Labs")
      : payments,
    documents: isClient
      ? operationalDocuments.filter(
          (document) =>
            document.clientId === clientId && document.visibility === "client",
        )
      : operationalDocuments,
    requests: isClient
      ? clientRequests.filter((request) => request.clientId === clientId)
      : clientRequests,
    achievements,
    achievementProgress,
    goals,
    goalProgress,
    milestones,
    streak,
    recognitions,
    preferences: gamificationPreferences,
    teamProgress,
  };
}
