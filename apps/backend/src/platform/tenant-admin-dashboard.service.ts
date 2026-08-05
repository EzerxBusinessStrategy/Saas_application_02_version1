import { Inject, Injectable } from "@nestjs/common";
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
    const data = await this.repository.getDashboardData(context);
    const hasFinancialYear = data.financialYear !== null;

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
      financialDataAvailable: hasFinancialYear,
      financialDataUnavailableReason: hasFinancialYear
        ? null
        : "CURRENT_FINANCIAL_YEAR_NOT_CONFIGURED",
      metrics: {
        activeClients: data.metrics.activeClients,
        totalSales:
          hasFinancialYear && data.metrics.totalSalesAmount !== null
            ? {
                amount: data.metrics.totalSalesAmount,
                currencyCode: data.metrics.currencyCode,
              }
            : null,
        openTasks: data.metrics.openTasks,
        overdueTasks: data.metrics.overdueTasks,
        slaCompliancePercent: data.metrics.slaCompliancePercent,
        employeeUtilisationPercent: data.metrics.employeeUtilisationPercent,
        outstanding:
          hasFinancialYear && data.metrics.outstandingAmount !== null
            ? {
                amount: data.metrics.outstandingAmount,
                currencyCode: data.metrics.currencyCode,
              }
            : null,
      },
      recentActivity: data.recentActivity.map((act) => ({
        action: act.action,
        actor: act.actor,
        createdAt: act.createdAt.toISOString(),
      })),
    };
  }
}
