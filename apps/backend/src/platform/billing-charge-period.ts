export const billingFrequencies = ["monthly", "quarterly", "annually", "one_time"] as const;
export type BillingFrequency = (typeof billingFrequencies)[number];

export function isBillingFrequency(value: string): value is BillingFrequency {
  return (billingFrequencies as readonly string[]).includes(value);
}

export function toBillingFrequency(value: string | null | undefined): BillingFrequency {
  return value && isBillingFrequency(value) ? value : "one_time";
}

export function resolveBillingPeriodKey(input: {
  readonly frequency: BillingFrequency;
  readonly periodLabel: string;
  readonly taskId: string;
  readonly financialYearLabel?: string | null;
  readonly financialYearStartsOn?: string | null;
  readonly financialYearEndsOn?: string | null;
}): string {
  switch (input.frequency) {
    case "monthly":
      return monthlyPeriodKey(input.periodLabel);
    case "quarterly":
      return quarterlyPeriodKey(input.periodLabel);
    case "annually":
      return annualPeriodKey(
        input.financialYearLabel,
        input.financialYearStartsOn,
        input.financialYearEndsOn,
        input.periodLabel,
      );
    case "one_time":
      return input.taskId;
    default: {
      const exhaustive: never = input.frequency;
      return exhaustive;
    }
  }
}

export function billingPeriodDisplayLabel(frequency: BillingFrequency, periodKey: string): string {
  switch (frequency) {
    case "monthly": {
      const [year, month] = periodKey.split("-").map(Number);
      if (year && month >= 1 && month <= 12) {
        return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
      }
      return periodKey;
    }
    case "quarterly": {
      const match = periodKey.match(/^(\d{4})-Q([1-4])$/i);
      return match ? `Q${match[2]} ${match[1]}` : periodKey;
    }
    case "annually":
      return periodKey.replace(/^FY-/, "FY ").replace(/-(\d{2})$/, "–$1");
    case "one_time":
      return "One-time";
    default: {
      const exhaustive: never = frequency;
      return exhaustive;
    }
  }
}

export function billingFrequencyDisplayLabel(frequency: BillingFrequency): string {
  switch (frequency) {
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "annually":
      return "Annual";
    case "one_time":
      return "One-time";
    default: {
      const exhaustive: never = frequency;
      return exhaustive;
    }
  }
}

export function billingGroupStatus(readyCount: number, expectedCount: number): "hidden" | "waiting" | "ready" {
  if (readyCount <= 0 || expectedCount <= 0) return "hidden";
  if (readyCount < expectedCount) return "waiting";
  return "ready";
}

export function billingGroupId(parts: {
  readonly clientId: string;
  readonly serviceId: string;
  readonly engagementId: string | null;
  readonly billingFrequency: string;
  readonly billingPeriodKey: string;
  readonly currency: string;
  readonly financialYearId: string;
}): string {
  return [
    parts.clientId,
    parts.serviceId,
    parts.engagementId ?? "none",
    parts.billingFrequency,
    parts.billingPeriodKey,
    parts.currency,
    parts.financialYearId,
  ].join(":");
}

export function billingGroupLabel(frequency: BillingFrequency, periodKey: string): string {
  const frequencyLabel = billingFrequencyDisplayLabel(frequency);
  const periodLabel = billingPeriodDisplayLabel(frequency, periodKey);
  if (frequency === "one_time") return frequencyLabel;
  return `${frequencyLabel} · ${periodLabel}`;
}

function monthlyPeriodKey(periodLabel: string): string {
  const yearMonth = periodLabel.match(/^(\d{4})-(\d{2})/);
  return yearMonth ? `${yearMonth[1]}-${yearMonth[2]}` : periodLabel;
}

function quarterlyPeriodKey(periodLabel: string): string {
  const canonical = periodLabel.match(/^(\d{4})-Q([1-4])$/i);
  if (canonical) return `${canonical[1]}-Q${canonical[2]}`;
  const labeled = periodLabel.match(/^Q([1-4])\s+(\d{4})$/i);
  if (labeled) return `${labeled[2]}-Q${labeled[1]}`;
  return periodLabel;
}

function annualPeriodKey(
  financialYearLabel: string | null | undefined,
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  periodLabel: string,
): string {
  const fromLabel = normalizeFinancialYearKey(financialYearLabel);
  if (fromLabel) return fromLabel;
  if (startsOn && endsOn) {
    const startYear = Number(startsOn.slice(0, 4));
    const endYear = Number(endsOn.slice(0, 4));
    if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear > startYear) {
      return `FY-${startYear}-${String(endYear).slice(2)}`;
    }
    if (Number.isFinite(startYear)) return `FY-${startYear}`;
  }
  const yearOnly = periodLabel.match(/^(\d{4})$/);
  return yearOnly ? `FY-${yearOnly[1]}` : periodLabel;
}

function normalizeFinancialYearKey(label: string | null | undefined): string | null {
  if (!label) return null;
  const normalized = label.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const fyRange = normalized.match(/FY\s*(\d{4})-(\d{2})\b/i);
  if (fyRange) return `FY-${fyRange[1]}-${fyRange[2]}`;
  const fyYear = normalized.match(/FY\s*(\d{4})\b/i);
  if (fyYear) return `FY-${fyYear[1]}`;
  return null;
}
