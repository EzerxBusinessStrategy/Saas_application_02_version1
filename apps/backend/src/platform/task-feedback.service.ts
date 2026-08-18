import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import { requireEmployeeContext } from "./employee-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  ClientTaskFeedbackDto,
  PendingTaskFeedbackResponseDto,
  SubmitClientTaskFeedback,
  TaskFeedbackLogQuery,
  TaskFeedbackLogResponseDto,
} from "./task-feedback.dto";
import { TaskFeedbackRepository } from "./task-feedback.repository";

@Injectable()
export class TaskFeedbackService {
  constructor(@Inject(TaskFeedbackRepository) private readonly repository: TaskFeedbackRepository) {}

  listPending(context: RequestContext): Promise<PendingTaskFeedbackResponseDto> {
    return this.repository
      .listPendingForClient(requireClientPortalContext(context))
      .then((items) => ({ items: [...items] }));
  }

  submit(context: RequestContext, input: SubmitClientTaskFeedback): Promise<ClientTaskFeedbackDto> {
    return this.repository.submitForClient(requireClientPortalContext(context), input);
  }

  listTenantLog(context: RequestContext, query: TaskFeedbackLogQuery): Promise<TaskFeedbackLogResponseDto> {
    return this.repository.listForTenant(requireTenantAdminContext(context), query).then((result) => ({
      items: [...result.items],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    }));
  }

  listEmployeeLog(context: RequestContext): Promise<TaskFeedbackLogResponseDto> {
    return this.repository.listForEmployee(requireEmployeeContext(context)).then((result) => {
      const pageSize = 100;
      const page = 1;
      return {
        items: [...result.items],
        total: result.total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(result.total / pageSize)),
      };
    });
  }
}
