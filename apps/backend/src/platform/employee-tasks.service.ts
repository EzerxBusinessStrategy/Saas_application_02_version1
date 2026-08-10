import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireEmployeeContext } from "./employee-context";
import { EmployeeTaskDto, EmployeeTasksResponseDto, EmployeeWorkLogsResponseDto } from "./employee-tasks.dto";
import { EmployeeTaskRow, EmployeeTasksRepository } from "./employee-tasks.repository";

@Injectable()
export class EmployeeTasksService {
  constructor(@Inject(EmployeeTasksRepository) private readonly repository: EmployeeTasksRepository) {}

  async list(context: RequestContext): Promise<EmployeeTasksResponseDto> {
    const scoped = requireEmployeeContext(context);
    return { tasks: (await this.repository.listTasks(scoped)).map(mapTask) };
  }

  async workLogs(context: RequestContext): Promise<EmployeeWorkLogsResponseDto> {
    const scoped = requireEmployeeContext(context);
    return {
      logs: (await this.repository.listWorkLogs(scoped)).map((log) => ({
        date: log.date,
        taskId: log.task_id,
        taskTitle: log.task_title,
        clientName: log.client_name,
        workedSeconds: Number(log.worked_seconds),
        segments: log.segments,
      })),
    };
  }

  async start(context: RequestContext, taskId: string): Promise<EmployeeTaskDto> {
    return mapTask(await this.repository.start(requireEmployeeContext(context), taskId));
  }

  async pause(context: RequestContext, taskId: string): Promise<EmployeeTaskDto> {
    return mapTask(await this.repository.pause(requireEmployeeContext(context), taskId));
  }

  async resume(context: RequestContext, taskId: string): Promise<EmployeeTaskDto> {
    return mapTask(await this.repository.resume(requireEmployeeContext(context), taskId));
  }

  async submit(context: RequestContext, taskId: string, taskComment: string): Promise<EmployeeTaskDto> {
    return mapTask(await this.repository.submit(requireEmployeeContext(context), taskId, taskComment));
  }
}

function mapTask(row: EmployeeTaskRow): EmployeeTaskDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "No description recorded.",
    clientId: row.client_id,
    clientName: row.client_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    workGroupId: row.work_group_id,
    workGroupName: row.work_group_name,
    assignedBy: row.assigned_by,
    priority: row.priority,
    status: row.status,
    plannedDueAt: row.planned_due_at?.toISOString() ?? null,
    needsChanges: row.status === "returned",
    latestManagerNote: row.latest_manager_note,
    timer: {
      status: row.timer_status,
      workedSeconds: Number(row.worked_seconds),
      activeSegmentStartedAt: row.active_segment_started_at?.toISOString() ?? null,
      serverTime: row.server_time.toISOString(),
    },
  };
}
