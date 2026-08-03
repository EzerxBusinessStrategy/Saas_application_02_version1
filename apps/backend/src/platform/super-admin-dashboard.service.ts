import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import {
  DashboardActivityDto,
  MoneyAmountDto,
  PlatformAlertDto,
  SuperAdminDashboardQuery,
  SuperAdminDashboardResponseDto,
  TenantReviewDto,
  TenantTurnoverHealthDto,
  TurnoverTrendPointDto,
} from "./super-admin-dashboard.dto";
import { UpdateReviewRequest } from "./super-admin-dashboard-actions.dto";
import {
  DashboardAuditRow,
  DashboardCurrencyTotalRow,
  DashboardHealthBandRow,
  DashboardPlatformAlertRow,
  DashboardTenantReviewRow,
  DashboardTenantRow,
  DashboardTrendRow,
  SuperAdminDashboardRepository,
} from "./super-admin-dashboard.repository";

@Injectable()
export class SuperAdminDashboardService {
  constructor(
    @Inject(SuperAdminDashboardRepository)
    private readonly repository: SuperAdminDashboardRepository,
  ) {}

  async getDashboard(
    context: RequestContext,
    filters: SuperAdminDashboardQuery,
  ): Promise<SuperAdminDashboardResponseDto> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) {
      throw forbiddenPortal();
    }

    const rows = await this.repository.getDashboardRows(context, filters);
    const metricTenants = rows.metricTenants.map(mapTenant);
    const tableTenants = rows.tenantRows.map(mapTenant);
    const visibleTenantHealth = filterTenantHealth(tableTenants, filters.health);
    const tenantIds = new Set(visibleTenantHealth.map((tenant) => tenant.tenantId));

    return {
      superAdmin: {
        id: rows.user.id,
        name: rows.user.display_name,
        email: rows.user.email,
        initials: initialsFromName(rows.user.display_name),
      },
      metrics: {
        totalTenants: rows.platformStatus.total_tenants,
        totalTurnoverByCurrency: rows.currencyTotals.map((row) => mapMoney(row, "turnover")),
        collectedByCurrency: rows.currencyTotals.map((row) => mapMoney(row, "collected")),
        outstandingByCurrency: rows.currencyTotals.map((row) => mapMoney(row, "outstanding")),
        lowHealthTenants: metricTenants.filter((tenant) => tenant.health === "LOW").length,
      },
      platformStatus: {
        activeTenants: rows.platformStatus.active_tenants,
        suspendedTenants: rows.platformStatus.suspended_tenants,
        pendingTenantReviews: rows.platformStatus.pending_tenant_reviews,
        activeTenantUsers: rows.platformStatus.active_tenant_users,
      },
      tenantHealth: visibleTenantHealth,
      recentActivity: rows.audit.map(mapRecentActivity),
      platformAlerts: rows.platformAlerts.map(mapPlatformAlert),
      tenantReviews: rows.tenantReviews.map(mapTenantReview),
      turnoverTrend: rows.trend.filter((row) => tenantIds.has(row.tenant_id)).map(mapTrend),
      filterOptions: {
        financialYears: rows.financialYears.map((year) => ({
          id: year.id,
          label: year.label,
          startDate: year.start_date,
          endDate: year.end_date,
        })),
        countries: rows.countries,
        healthBands: rows.healthBands.map(mapHealthBand),
        healthCounts: healthCounts(tableTenants, rows.healthBands),
        tenantStatuses: rows.tenantStatuses,
      },
      appliedFilters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        periodMode: filters.periodMode ?? "CURRENT_FY",
        financialYearId: filters.financialYearId ?? null,
        health: filters.health ?? null,
        country: filters.country ?? null,
        search: filters.search ?? null,
        tenantStatus: filters.tenantStatus ?? null,
      },
      };
  }

  async markAlertViewed(context: RequestContext, alertId: string): Promise<void> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) throw forbiddenPortal();
    await this.repository.markAlertViewed(context, alertId);
  }

  async createReviewFromAlert(context: RequestContext, alertId: string): Promise<void> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) throw forbiddenPortal();
    await this.repository.createReviewFromAlert(context, alertId);
  }

  async updateReview(context: RequestContext, reviewId: string, input: UpdateReviewRequest): Promise<void> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) throw forbiddenPortal();
    await this.repository.updateReviewStatus(context, reviewId, input);
  }
}

function mapTenant(row: DashboardTenantRow): TenantTurnoverHealthDto {
  const turnover = moneyNumber(row.turnover);
  const collected = moneyNumber(row.collected);
  const outstanding = moneyNumber(row.outstanding);
  const collectionRate = turnover > 0 ? round((collected / turnover) * 100) : 0;
  const outstandingRate = turnover > 0 ? (outstanding / turnover) * 100 : 100;

  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    country: row.country,
    currencyCode: row.currency_code,
    tenantStatus: row.tenant_status,
    turnover: moneyString(turnover),
    collected: moneyString(collected),
    outstanding: moneyString(outstanding),
    growthPercentage: null,
    collectionRate,
    invoiceCount: Number(row.invoice_count),
    activeUsers: Number(row.active_users),
    health: row.health_code ?? "LOW",
    healthLabel: row.health_label ?? "Low",
    financialCondition:
      turnover === 0 || outstandingRate >= 50
        ? "AT_RISK"
        : collectionRate >= 80
          ? "GOOD"
          : "ATTENTION_REQUIRED",
    financialYear: row.financial_year_id
      ? {
          id: row.financial_year_id,
          label: row.financial_year_label ?? "Current FY",
          startDate: row.financial_year_start_date ?? "",
          endDate: row.financial_year_end_date ?? "",
        }
      : null,
    financialYears: normalizeFinancialYears(row.financial_years),
  };
}

function normalizeFinancialYears(
  value: DashboardTenantRow["financial_years"],
): readonly { id: string; label: string; startDate: string; endDate: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((year) => ({
      id: String(year.id),
      label: String(year.label),
      startDate: String(year.start_date),
      endDate: String(year.end_date),
    }))
    .filter((year) => year.id && year.label);
}

function filterTenantHealth(
  tenants: readonly TenantTurnoverHealthDto[],
  health: SuperAdminDashboardQuery["health"],
): readonly TenantTurnoverHealthDto[] {
  return health ? tenants.filter((tenant) => tenant.health === health) : tenants;
}

function mapMoney(
  row: DashboardCurrencyTotalRow,
  key: "turnover" | "collected" | "outstanding",
): MoneyAmountDto {
  return {
    currencyCode: row.currency_code,
    amount: moneyString(moneyNumber(row[key])),
  };
}

function mapPlatformAlert(row: DashboardPlatformAlertRow): PlatformAlertDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    severity: row.severity as PlatformAlertDto["severity"],
    actionUrl: row.action_url,
    createdAt: row.created_at.toISOString(),
    status: row.status.toUpperCase() as PlatformAlertDto["status"],
  };
}

function mapTenantReview(row: DashboardTenantReviewRow): TenantReviewDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    reviewType: row.review_type,
    reason: row.reason,
    priority: row.priority.toUpperCase() as TenantReviewDto["priority"],
    dueDate: row.due_date,
    assignedReviewer: row.assigned_reviewer,
    status: row.status.toUpperCase() as TenantReviewDto["status"],
  };
}

function mapRecentActivity(row: DashboardAuditRow): DashboardActivityDto {
  return {
    id: row.id,
    title: titleCase(row.action),
    description: friendlyActivityDescription(row),
    tenantName: row.tenant_name,
    actorName: row.actor_name ?? "System",
    occurredAt: row.created_at.toISOString(),
  };
}

function mapTrend(row: DashboardTrendRow): TurnoverTrendPointDto {
  return {
    tenantId: row.tenant_id,
    month: row.month,
    currencyCode: row.currency_code,
    turnover: moneyString(moneyNumber(row.turnover)),
  };
}

function friendlyActivityDescription(row: DashboardAuditRow): string {
  const target = row.tenant_name ?? row.target ?? "Platform";
  if (row.action === "PLATFORM_SUPER_ADMIN_BOOTSTRAPPED") return `${row.actor_name ?? "System"} created the first Super Admin.`;
  if (row.action === "TENANT_REVIEW_CREATED") return `${target} review was created.`;
  if (row.action === "TENANT_REVIEW_STARTED") return `${target} review moved to in progress.`;
  if (row.action === "TENANT_REVIEW_COMPLETED") return `${target} review was completed.`;
  if (row.action === "PLATFORM_ALERT_VIEWED") return `${target} alert was viewed.`;
  return `${target} - ${row.actor_name ?? "System"}`;
}

function healthCounts(
  tenants: readonly TenantTurnoverHealthDto[],
  bands: readonly DashboardHealthBandRow[],
) {
  return [
    { code: null, label: "All", count: tenants.length },
    ...bands.map((band) => ({
      code: band.code,
      label: band.label,
      count: tenants.filter((tenant) => tenant.health === band.code).length,
    })),
  ];
}

function mapHealthBand(row: DashboardHealthBandRow) {
  return {
    code: row.code,
    label: row.label,
    minimumTurnover: moneyNumber(row.minimum_turnover),
    maximumTurnover: row.maximum_turnover === null ? null : moneyNumber(row.maximum_turnover),
  };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "S") + (parts[1]?.[0] ?? "A")).toUpperCase();
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function moneyNumber(value: string | number): number {
  return Number(value) || 0;
}

function moneyString(value: number): string {
  return moneyNumber(value).toFixed(2);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
