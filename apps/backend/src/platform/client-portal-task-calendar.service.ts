import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import {
  ClientPortalTaskCalendarQuery,
  ClientPortalTaskCalendarResponseDto,
} from "./client-portal-task-calendar.dto";
import { ClientPortalTaskCalendarRepository } from "./client-portal-task-calendar.repository";

@Injectable()
export class ClientPortalTaskCalendarService {
  constructor(
    @Inject(ClientPortalTaskCalendarRepository)
    private readonly repository: ClientPortalTaskCalendarRepository,
  ) {}

  async list(
    context: RequestContext,
    query: ClientPortalTaskCalendarQuery,
  ): Promise<ClientPortalTaskCalendarResponseDto> {
    const scoped = requireClientPortalContext(context);
    const data = await this.repository.list(scoped, query);

    return {
      period: {
        from: query.from,
        to: query.to,
      },
      total: data.tasks.length,
      tasks: data.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        plannedDueAt: task.plannedDueAt.toISOString(),
        serviceId: task.serviceId,
        serviceName: task.serviceName,
        frequency: task.frequency,
        assignees: task.assignees.map((assignee) => ({
          id: assignee.id,
          name: assignee.name,
        })),
      })),
    };
  }
}
