import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  CreateTenantAdminTaskRequest,
  TenantAdminTaskItemDto,
  TenantAdminTaskOptionsResponseDto,
  TenantAdminTasksResponseDto,
} from "./tenant-admin-tasks.dto";
import { TenantAdminTaskRow, TenantAdminTasksRepository } from "./tenant-admin-tasks.repository";

@Injectable()
export class TenantAdminTasksService {
  constructor(
    @Inject(TenantAdminTasksRepository)
    private readonly repository: TenantAdminTasksRepository,
  ) {}

  async getOptions(context: RequestContext): Promise<TenantAdminTaskOptionsResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    return this.repository.getOptions(tenantContext);
  }

  async listTasks(context: RequestContext, clientId?: string): Promise<TenantAdminTasksResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    return {
      tasks: (await this.repository.listTasks(tenantContext, clientId)).map(mapTask),
    };
  }

  async createTask(
    context: RequestContext,
    input: CreateTenantAdminTaskRequest,
  ): Promise<TenantAdminTaskItemDto> {
    const tenantContext = requireTenantAdminContext(context);
    return mapTask(await this.repository.createTask(tenantContext, input));
  }
}

function mapTask(row: TenantAdminTaskRow): TenantAdminTaskItemDto {
  return {
    ...row,
    plannedDueAt: row.plannedDueAt ? row.plannedDueAt.toISOString() : null,
  };
}
