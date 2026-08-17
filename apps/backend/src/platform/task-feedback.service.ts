import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import { requireEmployeeContext } from "./employee-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  ClientTaskFeedbackDto,
  PendingTaskFeedbackResponseDto,
  SubmitClientTaskFeedback,
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

  listTenantLog(context: RequestContext): Promise<TaskFeedbackLogResponseDto> {
    return this.repository.listForTenant(requireTenantAdminContext(context)).then((result) => ({
      items: [...result.items],
      total: result.total,
    }));
  }

  listEmployeeLog(context: RequestContext): Promise<TaskFeedbackLogResponseDto> {
    return this.repository.listForEmployee(requireEmployeeContext(context)).then((result) => ({
      items: [...result.items],
      total: result.total,
    }));
  }
}
