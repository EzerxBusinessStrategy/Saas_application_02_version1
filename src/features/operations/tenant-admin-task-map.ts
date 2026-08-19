import type { TenantAdminTask } from "@/features/operations/api/operations-api";
import type { AllocatedWorkTask } from "@/features/tenant-admin/api/open-tasks-api";
import type { OperationalTask } from "@/types/operations";

const tenantAdminStatuses: ReadonlySet<TenantAdminTask["status"]> = new Set([
  "draft",
  "requested",
  "open",
  "assigned",
  "in_progress",
  "submitted",
  "manager_review",
  "returned",
  "tenant_approval",
  "approved",
  "completed",
  "cancelled",
]);
const tenantAdminPriorities: ReadonlySet<TenantAdminTask["priority"]> = new Set([
  "low",
  "normal",
  "high",
  "urgent",
]);
const tenantAdminSlaStatuses: ReadonlySet<TenantAdminTask["slaStatus"]> = new Set([
  "not_started",
  "running",
  "met",
  "near_breach",
  "breached",
  "not_applicable",
]);

const pendingReviewStatuses: ReadonlySet<TenantAdminTask["status"]> = new Set([
  "submitted",
  "manager_review",
  "tenant_approval",
]);

export function tenantTaskReviewHref(taskId?: string) {
  return taskId
    ? `/admin/task-review?task=${encodeURIComponent(taskId)}`
    : "/admin/task-review";
}

export function isTenantAdminTaskAwaitingReview(task: TenantAdminTask) {
  if (task.latestSubmissionStatus === "returned") return false;
  return pendingReviewStatuses.has(task.status);
}

export function mapTenantAdminTask(task: TenantAdminTask): OperationalTask {
  const assignee = task.assignees.length
    ? task.assignees.map((item) => item.name).join(", ")
    : "Unassigned";
  const awaitingReview = isTenantAdminTaskAwaitingReview(task);

  return {
    id: task.id,
    tenantId: "authenticated",
    clientId: task.clientId,
    client: task.clientName,
    engagement: task.serviceName,
    workGroup: task.workGroupName ?? "No work group",
    managerId: "",
    manager: "Manager not assigned",
    assigneeId: task.assignees[0]?.id ?? "",
    assignee: task.assigneeCount > 1 ? `${task.assigneeCount} employees` : assignee,
    title: task.title,
    description: task.description ?? "No description recorded.",
    priority: mapTaskPriority(task.priority),
    complexity: "standard",
    status: mapTenantAdminTaskFeatureStatus(task),
    sla: task.slaStatus === "near_breach" || task.slaStatus === "breached" ? "at-risk" : "on-track",
    dueDate: task.plannedDueAt ? formatTaskDate(task.plannedDueAt) : "No due date",
    checklist: [],
    dependencyIds: [],
    attachmentCount: 0,
    commentCount: 0,
    reviewStatus: awaitingReview
      ? "pending"
      : task.latestSubmissionStatus === "returned" || task.status === "returned"
        ? "changes-requested"
        : "not-required",
    approvalStatus: awaitingReview ? "pending" : "not-required",
    reviewComment: task.latestReviewRemarks,
    blocked: task.latestSubmissionStatus === "returned" || task.status === "returned",
  };
}

export function mapAllocatedWorkToOperationalTask(task: AllocatedWorkTask): OperationalTask {
  const mapped = mapTenantAdminTask({
    id: task.id,
    title: task.title,
    description: task.description,
    clientId: task.clientId,
    clientName: task.clientName,
    serviceId: task.serviceId,
    serviceName: task.serviceName,
    workGroupId: task.workGroupId,
    workGroupName: task.workGroupName,
    priority: tenantAdminPriorities.has(task.priority as TenantAdminTask["priority"])
      ? (task.priority as TenantAdminTask["priority"])
      : "normal",
    status: tenantAdminStatuses.has(task.status as TenantAdminTask["status"])
      ? (task.status as TenantAdminTask["status"])
      : "open",
    slaStatus: tenantAdminSlaStatuses.has(task.slaStatus as TenantAdminTask["slaStatus"])
      ? (task.slaStatus as TenantAdminTask["slaStatus"])
      : "running",
    plannedDueAt: task.plannedDueAt,
    assigneeCount: task.assignees.length,
    assignees: task.assignees.map((assignee) => ({ id: assignee.id, name: assignee.name })),
    latestSubmissionStatus: null,
    latestReviewRemarks: null,
  });
  return {
    ...mapped,
    sla: task.atRisk ? "at-risk" : mapped.sla,
  };
}

export function mapTenantAdminTaskFeatureStatus(
  task: Pick<TenantAdminTask, "status" | "latestSubmissionStatus">,
): OperationalTask["status"] {
  if (task.latestSubmissionStatus === "returned") return "rejected";
  return mapTaskStatus(task.status);
}

function mapTaskPriority(priority: TenantAdminTask["priority"]): OperationalTask["priority"] {
  if (priority === "urgent" || priority === "high") return "high";
  if (priority === "normal") return "medium";
  return "low";
}

function mapTaskStatus(status: TenantAdminTask["status"]): OperationalTask["status"] {
  if (status === "in_progress") return "in-progress";
  if (["submitted", "manager_review", "tenant_approval", "approved"].includes(status)) return "review";
  if (status === "returned") return "rejected";
  if (status === "completed") return "done";
  return "to-do";
}

function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
