import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import {
  EmployeePerformanceDetailDto,
  EmployeePerformanceItemDto,
  QueryEmployeePerformanceDto,
  TenantAdminEmployeePerformanceResponseDto,
} from "./tenant-admin-employee-performance.dto";
import {
  RawEmployeePerformanceRow,
  TenantAdminEmployeePerformanceRepository,
} from "./tenant-admin-employee-performance.repository";
import { requireTenantAdminContext } from "./tenant-admin-context";

const MINIMUM_COMPLETED_TASKS_FOR_RANKING = 3;

@Injectable()
export class TenantAdminEmployeePerformanceService {
  constructor(
    @Inject(TenantAdminEmployeePerformanceRepository)
    private readonly repository: TenantAdminEmployeePerformanceRepository,
  ) {}

  async getPerformanceList(
    context: RequestContext,
    query: QueryEmployeePerformanceDto,
  ): Promise<TenantAdminEmployeePerformanceResponseDto> {
    const tenantContext = requireTenantAdminContext(context);
    const { period, rows, tenantCurrency } = await this.repository.getPerformanceData(tenantContext, {
      from: query.from,
      to: query.to,
      clientId: query.clientId,
      employeeId: query.employeeId,
      status: query.status,
    });

    const items = this.processAndScoreEmployees(rows, tenantCurrency);
    const sorted = this.sortItems(items, query.sortBy ?? "performanceScore", query.sortOrder);
    const ranked = this.assignRanks(sorted);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const total = ranked.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedItems = ranked.slice((page - 1) * limit, page * limit);

    const summary = this.buildSummary(ranked);

    return {
      period,
      summary,
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getEmployeeDetail(
    context: RequestContext,
    employeeId: string,
    query: { from?: string; to?: string },
  ): Promise<EmployeePerformanceDetailDto> {
    const tenantContext = requireTenantAdminContext(context);
    const { period, employeeRow, clientBreakdown, taskHistory, tenantCurrency } =
      await this.repository.getEmployeeDetail(tenantContext, employeeId, query);

    if (!employeeRow) {
      throw new Error(`Employee with ID ${employeeId} not found`);
    }

    const items = this.processAndScoreEmployees([employeeRow], tenantCurrency);
    const performance = items[0];

    const clientItems = clientBreakdown.map((cb) => {
      const completionRate =
        cb.assigned_tasks > 0 ? Math.round((cb.completed_tasks / cb.assigned_tasks) * 10000) / 100 : null;
      const onTimeRate =
        cb.completed_tasks > 0 ? Math.round((cb.on_time_completed_tasks / cb.completed_tasks) * 10000) / 100 : null;
      const avgSla =
        cb.sla_measured_tasks > 0 ? Math.round(cb.total_actual_sla_minutes! / cb.sla_measured_tasks) : null;
      const slaEfficiency =
        cb.total_target_sla_minutes && cb.total_target_sla_minutes > 0
          ? Math.round((cb.total_actual_sla_minutes! / cb.total_target_sla_minutes) * 100) / 100
          : null;
      const slaMetRate =
        cb.sla_measured_tasks > 0 ? Math.round((cb.sla_met_tasks / cb.sla_measured_tasks) * 10000) / 100 : null;

      return {
        clientId: cb.client_id,
        clientName: cb.client_name,
        assignedTasks: cb.assigned_tasks,
        completedTasks: cb.completed_tasks,
        completionRatePercent: completionRate,
        onTimeCompletionRatePercent: onTimeRate,
        averageSlaMinutes: avgSla,
        slaEfficiencyRatio: slaEfficiency,
        slaMetRatePercent: slaMetRate,
        revenueContribution:
          cb.attributed_revenue && cb.attributed_revenue > 0
            ? { amount: cb.attributed_revenue.toFixed(2), currencyCode: tenantCurrency }
            : null,
      };
    });

    const historyItems = taskHistory.map((th) => ({
      taskId: th.task_id,
      title: th.title,
      clientName: th.client_name,
      assignedAt: th.assigned_at.toISOString(),
      startedAt: th.started_at ? th.started_at.toISOString() : null,
      completedAt: th.completed_at ? th.completed_at.toISOString() : null,
      allowedSlaMinutes: th.allowed_sla_minutes,
      actualSlaMinutes: th.actual_sla_minutes,
      slaStatus: th.sla_status,
      revenueContribution: th.revenue_amount
        ? { amount: Number(th.revenue_amount).toFixed(2), currencyCode: tenantCurrency }
        : null,
    }));

    return {
      period,
      performance,
      clientBreakdown: clientItems,
      taskHistory: historyItems,
    };
  }

  private processAndScoreEmployees(
    rows: readonly RawEmployeePerformanceRow[],
    tenantCurrency: string,
  ): readonly EmployeePerformanceItemDto[] {
    const maxRevenue = Math.max(...rows.map((r) => r.attributed_revenue ?? 0), 1);

    return rows.map((r) => {
      const eligibleAssigned = Math.max(0, r.total_assigned_tasks - r.cancelled_tasks);
      const completionRate =
        eligibleAssigned > 0 ? Math.round((r.completed_tasks / eligibleAssigned) * 10000) / 100 : null;
      const onTimeRate =
        r.completed_tasks > 0 ? Math.round((r.on_time_completed_tasks / r.completed_tasks) * 10000) / 100 : null;

      const avgSla = r.sla_measured_tasks > 0 ? Math.round(r.total_actual_sla_minutes! / r.sla_measured_tasks) : null;

      const sortedSlaArr = [...r.sla_minutes_array].sort((a, b) => a - b);
      const mid = Math.floor(sortedSlaArr.length / 2);
      const medianSla =
        sortedSlaArr.length > 0
          ? sortedSlaArr.length % 2 !== 0
            ? sortedSlaArr[mid]
            : Math.round((sortedSlaArr[mid - 1] + sortedSlaArr[mid]) / 2)
          : null;

      const slaEfficiency =
        r.total_target_sla_minutes && r.total_target_sla_minutes > 0
          ? Math.round((r.total_actual_sla_minutes! / r.total_target_sla_minutes) * 100) / 100
          : null;

      const slaMetRate =
        r.sla_measured_tasks > 0 ? Math.round((r.sla_met_tasks / r.sla_measured_tasks) * 10000) / 100 : null;

      const isEligible = r.completed_tasks >= MINIMUM_COMPLETED_TASKS_FOR_RANKING;
      const eligibilityReason = isEligible ? null : "INSUFFICIENT_COMPLETED_TASKS";

      const availableComponents: string[] = [];
      let taskScore: number | null = null;
      let slaScore: number | null = null;
      let revenueScore: number | null = null;

      if (completionRate !== null) {
        availableComponents.push("TASK");
        taskScore = completionRate * 0.6 + (onTimeRate ?? completionRate) * 0.4;
      }

      if (slaEfficiency !== null) {
        availableComponents.push("SLA");
        slaScore = Math.max(0, Math.min(100, Math.round((1.5 - slaEfficiency) * 100)));
      } else if (slaMetRate !== null) {
        availableComponents.push("SLA");
        slaScore = slaMetRate;
      }

      if (r.attributed_revenue !== null && r.attributed_revenue > 0) {
        availableComponents.push("REVENUE");
        revenueScore = Math.round((r.attributed_revenue / maxRevenue) * 100);
      }

      let compositeScore: number | null = null;
      if (isEligible && availableComponents.length > 0) {
        let weightSum = 0;
        let scoreSum = 0;
        if (taskScore !== null) {
          weightSum += 0.4;
          scoreSum += taskScore * 0.4;
        }
        if (slaScore !== null) {
          weightSum += 0.35;
          scoreSum += slaScore * 0.35;
        }
        if (revenueScore !== null) {
          weightSum += 0.25;
          scoreSum += revenueScore * 0.25;
        }
        compositeScore = weightSum > 0 ? Math.round((scoreSum / weightSum) * 10) / 10 : null;
      }

      return {
        rank: null,
        employee: {
          id: r.employee_id,
          name: r.display_name,
          role: r.role,
          status: r.employment_status,
        },
        clientsServed: r.clients_served,
        totalAssignedTasks: r.total_assigned_tasks,
        completedTasks: r.completed_tasks,
        openTasks: r.open_tasks,
        overdueTasks: r.overdue_tasks,
        cancelledTasks: r.cancelled_tasks,
        completionRatePercent: completionRate,
        onTimeCompletionRatePercent: onTimeRate,
        averageSlaMinutes: avgSla,
        medianSlaMinutes: medianSla,
        slaEfficiencyRatio: slaEfficiency,
        slaUnavailableReason: slaEfficiency !== null ? null : "SLA_TARGET_NOT_AVAILABLE",
        slaMetRatePercent: slaMetRate,
        revenueContribution:
          r.attributed_revenue && r.attributed_revenue > 0
            ? { amount: r.attributed_revenue.toFixed(2), currencyCode: tenantCurrency }
            : null,
        revenueUnavailableReason:
          r.attributed_revenue && r.attributed_revenue > 0
            ? null
            : "EMPLOYEE_REVENUE_ATTRIBUTION_NOT_AVAILABLE",
        performanceScore: compositeScore,
        scoreComponents: {
          taskScore: taskScore !== null ? Math.round(taskScore * 10) / 10 : null,
          slaScore: slaScore !== null ? Math.round(slaScore * 10) / 10 : null,
          revenueScore: revenueScore !== null ? Math.round(revenueScore * 10) / 10 : null,
        },
        availableComponents,
        isEligibleForRanking: isEligible,
        eligibilityReason,
      };
    });
  }

  private sortItems(
    items: readonly EmployeePerformanceItemDto[],
    sortBy: string,
    sortOrder?: "asc" | "desc",
  ): readonly EmployeePerformanceItemDto[] {
    const isAsc = sortOrder === "asc";
    return [...items].sort((a, b) => {
      if (a.isEligibleForRanking !== b.isEligibleForRanking) {
        return a.isEligibleForRanking ? -1 : 1;
      }

      if (sortBy === "averageSla") {
        const valA = a.averageSlaMinutes ?? 999999;
        const valB = b.averageSlaMinutes ?? 999999;
        return (isAsc ? valA - valB : valB - valA);
      }

      if (sortBy === "completionRate") {
        const valA = a.completionRatePercent ?? -1;
        const valB = b.completionRatePercent ?? -1;
        return isAsc ? valA - valB : valB - valA;
      }

      if (sortBy === "revenue") {
        const valA = a.revenueContribution ? Number(a.revenueContribution.amount) : -1;
        const valB = b.revenueContribution ? Number(b.revenueContribution.amount) : -1;
        return isAsc ? valA - valB : valB - valA;
      }

      const valA = a.performanceScore ?? -1;
      const valB = b.performanceScore ?? -1;
      return isAsc ? valA - valB : valB - valA;
    });
  }

  private assignRanks(
    items: readonly EmployeePerformanceItemDto[],
  ): readonly EmployeePerformanceItemDto[] {
    let currentRank = 1;
    return items.map((item) => {
      if (item.isEligibleForRanking) {
        const rank = currentRank++;
        return { ...item, rank };
      }
      return { ...item, rank: null };
    });
  }

  private buildSummary(items: readonly EmployeePerformanceItemDto[]) {
    const eligibleItems = items.filter((i) => i.isEligibleForRanking);
    const eligibleEmployees = eligibleItems.length;

    const slaVals = items.map((i) => i.averageSlaMinutes).filter((v): v is number => v !== null);
    const tenantAverageSlaMinutes =
      slaVals.length > 0 ? Math.round(slaVals.reduce((a, b) => a + b, 0) / slaVals.length) : null;

    const compVals = items.map((i) => i.completionRatePercent).filter((v): v is number => v !== null);
    const tenantTaskCompletionRatePercent =
      compVals.length > 0 ? Math.round((compVals.reduce((a, b) => a + b, 0) / compVals.length) * 10) / 10 : null;

    const onTimeVals = items.map((i) => i.onTimeCompletionRatePercent).filter((v): v is number => v !== null);
    const tenantOnTimeCompletionRatePercent =
      onTimeVals.length > 0 ? Math.round((onTimeVals.reduce((a, b) => a + b, 0) / onTimeVals.length) * 10) / 10 : null;

    const topEmployeeId = eligibleItems[0]?.employee.id ?? null;

    return {
      eligibleEmployees,
      tenantAverageSlaMinutes,
      tenantTaskCompletionRatePercent,
      tenantOnTimeCompletionRatePercent,
      topEmployeeId,
    };
  }
}
