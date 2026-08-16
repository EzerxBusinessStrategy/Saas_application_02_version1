export const serviceBlueprintFrequencies = ["monthly", "quarterly", "annually", "one_time"] as const;
export const serviceBlueprintDueRuleTypes = [
  "fixed_day_of_month",
  "fixed_month_day",
  "days_after_period_end",
  "quarterly_due_date",
] as const;

export type ServiceBlueprintFrequency = (typeof serviceBlueprintFrequencies)[number];
export type ServiceBlueprintDueRuleType = (typeof serviceBlueprintDueRuleTypes)[number];

export type ServiceBlueprintDueRule = {
  readonly type: ServiceBlueprintDueRuleType;
  readonly day?: number;
  readonly month?: number;
  readonly days?: number;
  readonly date?: string;
};

export type RecurrenceOccurrence = {
  readonly dueOn: string;
  readonly periodLabel: string;
};

function parseIsoDate(value: string): { y: number; m: number; d: number } {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid ISO date.");
  }
  return { y: year, m: month, d: day };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIsoDate(year: number, month: number, day: number): string {
  const clamped = Math.min(day, lastDayOfMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

function addMonths(year: number, month: number, count: number): { y: number; m: number } {
  const index = year * 12 + (month - 1) + count;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

function compareIso(left: string, right: string): number {
  return left.localeCompare(right);
}

function dueDay(rule: ServiceBlueprintDueRule, fallback = 11): number {
  const day = rule.day ?? fallback;
  if (day < 1 || day > 31) return fallback;
  return day;
}

export function yearlyOccurrenceCount(frequency: ServiceBlueprintFrequency): number {
  switch (frequency) {
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "annually":
    case "one_time":
      return 1;
    default: {
      const exhaustive: never = frequency;
      return exhaustive;
    }
  }
}

export function expandRecurrenceOccurrences(input: {
  readonly frequency: ServiceBlueprintFrequency;
  readonly dueRule: ServiceBlueprintDueRule;
  readonly horizonStart: string;
  readonly horizonEnd: string;
  readonly skipBefore?: string;
}): readonly RecurrenceOccurrence[] {
  const skipBefore = input.skipBefore ?? input.horizonStart;
  const start = parseIsoDate(input.horizonStart);
  const end = parseIsoDate(input.horizonEnd);
  const occurrences: RecurrenceOccurrence[] = [];

  const include = (dueOn: string, periodLabel: string) => {
    if (compareIso(dueOn, skipBefore) < 0) return;
    if (compareIso(dueOn, input.horizonEnd) > 0) return;
    occurrences.push({ dueOn, periodLabel });
  };

  switch (input.frequency) {
    case "monthly": {
      const day = dueDay(input.dueRule);
      let cursor = { y: start.y, m: start.m };
      const last = { y: end.y, m: end.m };
      while (cursor.y < last.y || (cursor.y === last.y && cursor.m <= last.m)) {
        include(toIsoDate(cursor.y, cursor.m, day), `${cursor.y}-${String(cursor.m).padStart(2, "0")}`);
        cursor = addMonths(cursor.y, cursor.m, 1);
      }
      break;
    }
    case "quarterly": {
      const day = dueDay(input.dueRule, 15);
      const startQuarterMonth = Math.floor((start.m - 1) / 3) * 3 + 3;
      let cursor = { y: start.y, m: startQuarterMonth };
      if (cursor.m > 12) {
        cursor = { y: cursor.y + 1, m: 3 };
      }
      while (cursor.y < end.y || (cursor.y === end.y && cursor.m <= end.m)) {
        include(toIsoDate(cursor.y, cursor.m, day), `Q${Math.ceil(cursor.m / 3)} ${cursor.y}`);
        cursor = addMonths(cursor.y, cursor.m, 3);
      }
      break;
    }
    case "annually": {
      const month = input.dueRule.month && input.dueRule.month >= 1 && input.dueRule.month <= 12 ? input.dueRule.month : 3;
      const day = dueDay(input.dueRule, 31);
      for (let year = start.y; year <= end.y; year += 1) {
        include(toIsoDate(year, month, day), String(year));
      }
      break;
    }
    case "one_time": {
      const dueOn =
        input.dueRule.date && /^\d{4}-\d{2}-\d{2}$/.test(input.dueRule.date)
          ? input.dueRule.date
          : input.dueRule.type === "days_after_period_end"
            ? input.horizonStart
            : input.horizonStart;
      include(dueOn, dueOn);
      break;
    }
    default: {
      const exhaustive: never = input.frequency;
      throw new Error(`Unsupported frequency: ${String(exhaustive)}`);
    }
  }

  return occurrences;
}
