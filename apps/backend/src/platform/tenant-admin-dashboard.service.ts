import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { TenantAdminDashboardResponseDto } from "./tenant-admin-dashboard.dto";
import { TenantAdminDashboardRepository } from "./tenant-admin-dashboard.repository";

@Injectable()
export class TenantAdminDashboardService {
  constructor(
    @Inject(TenantAdminDashboardRepository)
    private readonly repository: TenantAdminDashboardRepository,
  ) {}

  async getDashboard(context: RequestContext): Promise<TenantAdminDashboardResponseDto> {
    if (!context.tenantId || !context.membershipId || context.isPlatformAdmin) {
      throw forbiddenPortal();
    }

    const data = await this.repository.getDashboardData(context);

    return {
      tenant: {
        id: data.tenant.id,
        name: data.tenant.name,
        currencyCode: data.tenant.currencyCode,
      },
      financialYear: data.financialYear
        ? {
            id: data.financialYear.id,
            label: data.financialYear.label,
            startsOn: data.financialYear.startsOn,
            endsOn: data.financialYear.endsOn,
          }
        : null,
      metrics: {
        activeClients: data.metrics.activeClients,
        totalSales: {
          amount: data.metrics.totalSalesAmount,
          currencyCode: data.metrics.currencyCode,
        },
        openTasks: data.metrics.openTasks,
        overdueTasks: data.metrics.overdueTasks,
        slaCompliancePercent: data.metrics.slaCompliancePercent,
        employeeUtilisationPercent: data.metrics.employeeUtilisationPercent,
        outstanding: {
          amount: data.metrics.outstandingAmount,
          currencyCode: data.metrics.currencyCode,
        },
      },
      recentActivity: data.recentActivity.map((act) => ({
        action: act.action,
        actor: act.actor,
        createdAt: act.createdAt.toISOString(),
      })),
    };
  }
}
