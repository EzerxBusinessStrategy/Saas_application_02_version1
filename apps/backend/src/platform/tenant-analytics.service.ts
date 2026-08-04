import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { TenantAnalyticsQuery, TenantAnalyticsResponseDto } from "./tenant-analytics.dto";
import { TenantAnalyticsRepository } from "./tenant-analytics.repository";

@Injectable()
export class TenantAnalyticsService {
  constructor(@Inject(TenantAnalyticsRepository) private readonly repository: TenantAnalyticsRepository) {}

  async get(context: RequestContext, query: TenantAnalyticsQuery): Promise<TenantAnalyticsResponseDto> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) throw forbiddenPortal();
    const data = await this.repository.get(context, query);
    const metrics = data.metrics;
    const totalTasks = Number(metrics.total_tasks);
    const measuredTasks = Number(metrics.sla_measured_tasks);
    return {
      tenants: data.tenants.map(mapTenant),
      selectedTenant: data.selectedTenant ? mapTenant(data.selectedTenant) : null,
      financialYears: data.financialYears.map(mapYear),
      selectedFinancialYear: data.selectedFinancialYear ? mapYear(data.selectedFinancialYear) : null,
      from: query.from ?? data.selectedFinancialYear?.start_date ?? null,
      to: query.to ?? data.selectedFinancialYear?.end_date ?? null,
      metrics: {
        turnover: money(metrics.turnover),
        collected: money(metrics.collected),
        outstanding: money(metrics.outstanding),
        invoices: Number(metrics.invoices),
        payments: Number(metrics.payments),
        clients: Number(metrics.clients),
        activeEmployees: Number(metrics.active_employees),
        totalTasks,
        completedTasks: Number(metrics.completed_tasks),
        slaCompliance: measuredTasks ? round((Number(metrics.sla_compliant_tasks) / measuredTasks) * 100) : 0,
        employeeCompletionRate: Number(metrics.assigned_tasks) ? round((Number(metrics.completed_tasks) / Number(metrics.assigned_tasks)) * 100) : 0,
      },
      trend: data.trend.map((row) => ({ month: row.month, turnover: money(row.turnover), collected: money(row.collected) })),
      clientRevenue: data.clientRevenue.map((row) => ({ clientName: row.client_name, turnover: money(row.turnover) })),
    };
  }
}

function mapTenant(tenant: { id: string; name: string; code: string; status: string; currency_code: string | null }) { return { id: tenant.id, name: tenant.name, code: tenant.code, status: tenant.status, currencyCode: tenant.currency_code }; }
function mapYear(year: { id: string; label: string; start_date: string; end_date: string }) { return { id: year.id, label: year.label, startDate: year.start_date, endDate: year.end_date }; }
function money(value: string) { return (Number(value) || 0).toFixed(2); }
function round(value: number) { return Math.round(value * 100) / 100; }
