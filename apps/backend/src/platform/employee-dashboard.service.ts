import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireEmployeeContext } from "./employee-context";
import { EmployeeDashboardResponseDto } from "./employee-dashboard.dto";
import { EmployeeDashboardRepository, EmployeeDashboardTaskRow } from "./employee-dashboard.repository";

@Injectable()
export class EmployeeDashboardService {
  constructor(
    @Inject(EmployeeDashboardRepository)
    private readonly repository: EmployeeDashboardRepository,
  ) {}

  async read(context: RequestContext): Promise<EmployeeDashboardResponseDto> {
    const scoped = requireEmployeeContext(context);
    const data = await this.repository.read(scoped);
    const today = new Date();
    const tasks = data.tasks.map(mapTask);

    return {
      employeeName: data.employee.name,
      today: today.toISOString(),
      summary: {
        dueToday: tasks.filter((task) => task.dueToday).length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        needsChanges: tasks.filter((task) => task.needsChanges).length,
      },
      tasks,
      workLog: data.workLog,
    };
  }
}

function mapTask(row: EmployeeDashboardTaskRow) {
  const needsChanges = row.status === "returned";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    clientName: row.client_name,
    serviceName: row.service_name,
    status: row.status,
    statusLabel: statusLabel(row.status),
    plannedDueAt: row.planned_due_at?.toISOString() ?? null,
    dueToday: row.due_today,
    actionLabel: needsChanges ? "Open task" : row.status === "in_progress" ? "Continue" : "Start",
    needsChanges,
    latestManagerNote: row.latest_manager_note,
  };
}

function statusLabel(status: string): string {
  if (status === "in_progress") return "In progress";
  if (status === "returned") return "Needs changes";
  if (status === "submitted") return "Submitted";
  if (status === "manager_review") return "In review";
  if (status === "tenant_approval") return "Tenant approval";
  if (status === "assigned") return "To do";
  if (status === "open") return "To do";
  return status.replaceAll("_", " ");
}
