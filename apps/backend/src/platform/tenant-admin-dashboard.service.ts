import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  TenantAdminDashboardQuery,
  TenantAdminDashboardResponseDto,
  TenantAdminCompletedTasksResponseDto,
  TenantAdminOpenTasksResponseDto,
  TenantProfileDto,
  UpdateTenantProfileRequest,
} from "./tenant-admin-dashboard.dto";
import { TenantAdminDashboardRepository, OpenTaskResult } from "./tenant-admin-dashboard.repository";
import { DashboardPeriod } from "./tenant-admin-dashboard.period";

@Injectable()
export class TenantAdminDashboardService {
  constructor(
    @Inject(TenantAdminDashboardRepository)
    private readonly repository: TenantAdminDashboardRepository,
  ) {}

  async getDashboard(
    context: RequestContext,
    query: TenantAdminDashboardQuery = {},
  ): Promise<TenantAdminDashboardResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    const data = await this.repository.getDashboardData(tenantContext, query);
    const hasFinancialYear = data.financialYear !== null;

    return {
      tenant: {
        id: data.tenant.id,
        name: data.tenant.name,
        currencyCode: data.tenant.currencyCode,
      },
      period: {
        from: data.period.from,
        to: data.period.to,
        source: data.period.source === "upcoming_year" ? "last_30_days" : data.period.source,
      },
      financialYear: data.financialYear
        ? {
            id: data.financialYear.id,
            label: data.financialYear.label,
            startsOn: data.financialYear.startsOn,
            endsOn: data.financialYear.endsOn,
          }
        : null,
      financialDataAvailable: hasFinancialYear,
      financialDataUnavailableReason: hasFinancialYear
        ? null
        : "CURRENT_FINANCIAL_YEAR_NOT_CONFIGURED",
      metrics: {
        activeClients: data.metrics.activeClients,
        totalSales:
          data.metrics.totalSalesAmount !== null
            ? {
                amount: data.metrics.totalSalesAmount,
                currencyCode: data.metrics.currencyCode,
              }
            : null,
        openTasks: data.metrics.openTasks,
        completedTasks: data.metrics.completedTasks,
        outstanding:
          data.metrics.outstandingAmount !== null
            ? {
                amount: data.metrics.outstandingAmount,
                currencyCode: data.metrics.currencyCode,
              }
            : null,
      },
      recentActivity: data.recentActivity.map((act) => ({
        id: act.id,
        action: act.action,
        label: humaniseActivity(act.action),
        resourceType: act.resourceType,
        resourceId: act.resourceId,
        result: act.result,
        metadata: act.metadata,
        actor: act.actor,
        createdAt: act.createdAt.toISOString(),
      })),
      organisationSetup: mapOrganisationSetup(data.organisationSetup),
      upcomingDeadlines: data.upcomingDeadlines.map((item) => ({
        id: item.id,
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        clientId: item.clientId,
        clientName: item.clientName,
        dueAt: item.dueAt.toISOString(),
        priority: item.priority,
        status: item.status,
        workGroupName: item.workGroupName,
        assigneeCount: item.assigneeCount,
      })),
    };
  }

  async listOpenTasks(
    context: RequestContext,
    query: TenantAdminDashboardQuery = {},
  ): Promise<TenantAdminOpenTasksResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    const data = await this.repository.listOpenTasks(tenantContext, query);
    return mapPeriodTaskListResponse(data.period, data.tasks);
  }

  async listCompletedTasks(
    context: RequestContext,
    query: TenantAdminDashboardQuery = {},
  ): Promise<TenantAdminCompletedTasksResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    const data = await this.repository.listCompletedTasks(tenantContext, query);
    return mapPeriodTaskListResponse(data.period, data.tasks);
  }

  async getTenantProfile(context: RequestContext): Promise<TenantProfileDto> {
    return this.repository.getTenantProfile(requireTenantAdminContext(context));
  }

  async updateTenantProfile(context: RequestContext, input: UpdateTenantProfileRequest): Promise<TenantProfileDto> {
    return this.repository.updateTenantProfile(requireTenantAdminContext(context), input.name);
  }
}

const activityLabels: Record<string, string> = {
  TASK_CREATED: "created a task",
  TASK_UPDATED: "updated a task",
  TASK_ASSIGNED: "assigned a task",
  CLIENT_CREATED: "created a client",
  INVOICE_CREATED: "created an invoice",
  PAYMENT_RECORDED: "recorded a payment",
  EMPLOYEE_CREATED: "created an employee",
};

function humaniseActivity(action: string): string {
  return activityLabels[action] ?? action.toLowerCase().replaceAll("_", " ");
}

function mapPeriodTaskListResponse(period: DashboardPeriod, tasks: readonly OpenTaskResult[]) {
  return {
    period: {
      from: period.from,
      to: period.to,
      source: period.source === "upcoming_year" ? ("last_30_days" as const) : period.source,
    },
    total: tasks.length,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      clientId: task.clientId,
      clientName: task.clientName,
      clientPublicIp: task.clientPublicIp,
      serviceId: task.serviceId,
      serviceName: task.serviceName,
      workGroupId: task.workGroupId,
      workGroupName: task.workGroupName,
      priority: task.priority,
      status: task.status,
      slaStatus: task.slaStatus,
      plannedDueAt: task.plannedDueAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      assignedAt: task.assignedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      assignees: task.assignees.map((assignee) => ({
        id: assignee.id,
        name: assignee.name,
        assignedAt: assignee.assignedAt.toISOString(),
      })),
    })),
  };
}

function mapOrganisationSetup(row: {
  readonly tenantProfileComplete: boolean;
  readonly financialYearComplete: boolean;
  readonly managerComplete: boolean;
  readonly employeesComplete: boolean;
  readonly clientsComplete: boolean;
  readonly servicesComplete: boolean;
}) {
  const items = [
    {
      key: "TENANT_PROFILE",
      label: "Organisation profile",
      description: "Configure country, currency and timezone.",
      completed: row.tenantProfileComplete,
      destination: "/tenant-administration/settings",
    },
    {
      key: "FINANCIAL_YEAR",
      label: "Financial year",
      description: "Configure the current financial year.",
      completed: row.financialYearComplete,
      destination: null,
    },
    {
      key: "MANAGERS",
      label: "Manager access",
      description: "Create at least one active manager.",
      completed: row.managerComplete,
      destination: "/tenant-administration/employees",
    },
    {
      key: "EMPLOYEES",
      label: "Employees",
      description: "Create at least one active employee.",
      completed: row.employeesComplete,
      destination: "/tenant-administration/employees",
    },
    {
      key: "CLIENTS",
      label: "Clients",
      description: "Create at least one active client.",
      completed: row.clientsComplete,
      destination: "/tenant-administration/clients",
    },
    {
      key: "SERVICES",
      label: "Services",
      description: "Create at least one active service.",
      completed: row.servicesComplete,
      destination: "/tenant-administration/services",
    },
  ];
  const completed = items.filter((item) => item.completed).length;
  return {
    completed,
    total: items.length,
    completionPercent: Math.round((completed / items.length) * 100),
    items,
  };
}
