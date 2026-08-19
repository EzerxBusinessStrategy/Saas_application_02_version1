export const ALLOCATED_WORK_STATUS_GROUPS = ["all", "open", "in_progress", "review", "completed", "overdue"] as const;
export type AllocatedWorkStatusGroup = (typeof ALLOCATED_WORK_STATUS_GROUPS)[number];

const REVIEW_STATUSES = ["submitted", "manager_review", "returned", "tenant_approval", "approved"] as const;

export function allocatedWorkStatusMatches(status: string, group: AllocatedWorkStatusGroup): boolean {
  if (group === "all") return status !== "cancelled";
  if (group === "open" || group === "overdue") return status !== "completed" && status !== "cancelled";
  if (group === "in_progress") return status === "in_progress";
  if (group === "review") return (REVIEW_STATUSES as readonly string[]).includes(status);
  if (group === "completed") return status === "completed";
  const exhaustive: never = group;
  return exhaustive;
}

export function allocatedWorkAtRiskReasons(input: {
  readonly status: string;
  readonly slaStatus: string;
  readonly plannedDueAt: Date | null;
  readonly now?: Date;
}): readonly string[] {
  if (input.status === "completed" || input.status === "cancelled") return [];
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  if (input.slaStatus === "breached") reasons.push("SLA breached.");
  if (input.slaStatus === "near_breach") reasons.push("SLA is near breach.");
  if (input.plannedDueAt && input.plannedDueAt.getTime() < now.getTime()) {
    reasons.push("Due date has passed.");
  }
  return reasons;
}

export function isAllocatedWorkAtRisk(input: {
  readonly status: string;
  readonly slaStatus: string;
  readonly plannedDueAt: Date | null;
  readonly now?: Date;
}): boolean {
  return allocatedWorkAtRiskReasons(input).length > 0;
}
