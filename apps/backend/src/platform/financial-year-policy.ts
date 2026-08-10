export type FinancialYearPolicyTemplate = {
  readonly policyMode: string;
  readonly startMonth: number;
  readonly startDay: number;
  readonly endMonth: number;
  readonly endDay: number;
};

export type SuggestedFinancialYear = {
  readonly label: string;
  readonly startsOn: string;
  readonly endsOn: string;
};

export function suggestFinancialYear(
  template: FinancialYearPolicyTemplate,
  incorporationDate?: string,
  today = new Date(),
): SuggestedFinancialYear | null {
  if (template.policyMode === "INCORPORATION_DERIVED") {
    if (!incorporationDate) return null;
    const incorporated = parseFinancialYearDate(incorporationDate);
    const anniversaryYear = incorporated.getUTCFullYear() + 1;
    const endsOn = lastDayOfMonth(anniversaryYear, incorporated.getUTCMonth() + 1);
    return {
      label: `FY ending ${endsOn.slice(0, 7)}`,
      startsOn: incorporationDate,
      endsOn,
    };
  }

  const startYear =
    today.getUTCMonth() + 1 > template.startMonth ||
      (today.getUTCMonth() + 1 === template.startMonth && today.getUTCDate() >= template.startDay)
      ? today.getUTCFullYear()
      : today.getUTCFullYear() - 1;
  const endYear = template.endMonth < template.startMonth ? startYear + 1 : startYear;
  const startsOn = isoDate(startYear, template.startMonth, template.startDay);
  const endsOn = isoDate(endYear, template.endMonth, template.endDay);
  return {
    label: template.startMonth === 4 && template.endMonth === 3
      ? `FY ${startYear}-${String(endYear).slice(2)}`
      : `FY ${startYear}`,
    startsOn,
    endsOn,
  };
}

export function parseFinancialYearDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new RangeError("Date is invalid.");
  return parsed;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): string {
  return isoDate(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
}
