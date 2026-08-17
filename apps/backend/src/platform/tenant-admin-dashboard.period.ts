export const DASHBOARD_MIN_FROM = "2015-01-01";
export const DASHBOARD_MAX_SPAN_DAYS = 731;
export const DASHBOARD_MAX_FUTURE_DAYS = 366;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DashboardPeriodSource = "query" | "financial_year" | "last_30_days" | "upcoming_year";

export type DashboardPeriod = {
  readonly from: string;
  readonly to: string;
  readonly source: DashboardPeriodSource;
};

export function isoDateDiffDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

export function addIsoDateDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function utcTodayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function resolveTenantDashboardPeriod(input: {
  readonly from?: string;
  readonly to?: string;
  readonly financialYear: { readonly startsOn: string; readonly endsOn: string } | null;
  readonly today: string;
}): DashboardPeriod {
  if (input.from && input.to) {
    return { from: input.from, to: input.to, source: "query" };
  }
  if (input.financialYear) {
    return {
      from: input.financialYear.startsOn,
      to: input.financialYear.endsOn,
      source: "financial_year",
    };
  }
  return {
    from: addIsoDateDays(input.today, -29),
    to: input.today,
    source: "last_30_days",
  };
}

export function startOfUtcMonth(isoDate: string): string {
  return `${isoDate.slice(0, 8)}01`;
}

export function resolveClientDashboardPeriod(input: {
  readonly from?: string;
  readonly to?: string;
  readonly today: string;
}): DashboardPeriod {
  if (input.from && input.to) {
    return { from: input.from, to: input.to, source: "query" };
  }
  return {
    from: startOfUtcMonth(input.today),
    to: addIsoDateDays(input.today, DASHBOARD_MAX_FUTURE_DAYS),
    source: "upcoming_year",
  };
}
