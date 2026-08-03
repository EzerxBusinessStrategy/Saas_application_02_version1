import type { Metric, Status } from "@/types/domain";

export type PlatformMetric = Metric;
export type TenantHealthRow = {
  name: string;
  users: number;
  status: Status;
  detail: string;
};
export type PlatformActivity = { title: string; detail: string; time: string };
export type PlatformAlert = { title: string; detail: string; status: Status };
export type PlatformOverview = {
  metrics: PlatformMetric[];
  tenantHealth: TenantHealthRow[];
  recentActivity: PlatformActivity[];
  alerts: PlatformAlert[];
};

export type DashboardHealthFilter =
  | "HIGH_PERFORMING"
  | "HEALTHY"
  | "DEVELOPING"
  | "LOW";

export type TenantStatusFilter =
  | "active"
  | "pending_activation"
  | "suspended"
  | "archived"
  | "provisioning";

export type ReportingPeriodMode = "CURRENT_FY" | "PREVIOUS_FY" | "CUSTOM_RANGE";

export type SuperAdminDashboardFilters = {
  from?: string;
  to?: string;
  periodMode?: ReportingPeriodMode;
  financialYearId?: string;
  health?: DashboardHealthFilter;
  tenantStatus?: TenantStatusFilter;
  country?: string;
  search?: string;
};

export type MoneyByCurrency = {
  currencyCode: string;
  amount: string;
};

export type SuperAdminDashboardData = {
  superAdmin: {
    id: string;
    name: string;
    email: string;
    initials: string;
  };
  metrics: {
    totalTenants: number;
    totalTurnoverByCurrency: MoneyByCurrency[];
    collectedByCurrency: MoneyByCurrency[];
    outstandingByCurrency: MoneyByCurrency[];
    lowHealthTenants: number;
  };
  platformStatus: {
    activeTenants: number;
    suspendedTenants: number;
    pendingTenantReviews: number;
    activeTenantUsers: number;
  };
  tenantHealth: TenantTurnoverHealthRow[];
  recentActivity: DashboardActivity[];
  platformAlerts: DashboardAlert[];
  tenantReviews: TenantReview[];
  turnoverTrend: TurnoverTrendPoint[];
  filterOptions: {
    financialYears: FinancialYearOption[];
    countries: string[];
    healthBands: TenantHealthBand[];
    healthCounts: HealthCount[];
    tenantStatuses: TenantStatusFilter[];
  };
  appliedFilters: {
    from: string | null;
    to: string | null;
    periodMode: ReportingPeriodMode;
    financialYearId: string | null;
    health: DashboardHealthFilter | null;
    tenantStatus: TenantStatusFilter | null;
    country: string | null;
    search: string | null;
  };
};

export type TenantTurnoverHealthRow = {
  tenantId: string;
  tenantName: string;
  country: string | null;
  tenantStatus: string;
  currencyCode: string | null;
  turnover: string;
  collected: string;
  outstanding: string;
  growthPercentage: number | null;
  collectionRate: number;
  invoiceCount: number;
  activeUsers: number;
  health: DashboardHealthFilter;
  healthLabel: string;
  financialCondition: "GOOD" | "ATTENTION_REQUIRED" | "AT_RISK";
  financialYear: FinancialYearOption | null;
  financialYears: FinancialYearOption[];
};

export type DashboardActivity = {
  id: string;
  title: string;
  description: string;
  tenantName: string | null;
  actorName: string;
  occurredAt: string;
};

export type DashboardAlert = {
  id: string;
  type: string;
  title: string;
  message: string;
  tenantId: string | null;
  tenantName: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  actionUrl: string | null;
  createdAt: string;
  status: "OPEN" | "VIEWED";
};

export type TenantReview = {
  id: string;
  tenantId: string;
  tenantName: string;
  reviewType: string;
  reason: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  dueDate: string | null;
  assignedReviewer: string | null;
  status: "PENDING" | "IN_PROGRESS" | "OVERDUE" | "COMPLETED" | "CANCELLED";
};

export type TurnoverTrendPoint = {
  tenantId: string;
  month: string;
  currencyCode: string | null;
  turnover: string;
};

export type FinancialYearOption = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type TenantHealthBand = {
  code: Exclude<DashboardHealthFilter, "SUSPENDED">;
  label: string;
  minimumTurnover: number;
  maximumTurnover: number | null;
};

export type HealthCount = {
  code: DashboardHealthFilter | null;
  label: string;
  count: number;
};
