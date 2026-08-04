export type TenantAnalytics = {
  tenants: { id: string; name: string; code: string; status: string; currencyCode: string | null }[];
  selectedTenant: { id: string; name: string; code: string; status: string; currencyCode: string | null } | null;
  financialYears: { id: string; label: string; startDate: string; endDate: string }[];
  selectedFinancialYear: { id: string; label: string; startDate: string; endDate: string } | null;
  from: string | null;
  to: string | null;
  metrics: { turnover: string; collected: string; outstanding: string; invoices: number; payments: number; clients: number; activeEmployees: number; totalTasks: number; completedTasks: number; slaCompliance: number; employeeCompletionRate: number };
  trend: { month: string; turnover: string; collected: string }[];
  clientRevenue: { clientName: string; turnover: string }[];
};

export type TenantAnalyticsFilters = { tenantId?: string; financialYearId?: string; from?: string; to?: string };
