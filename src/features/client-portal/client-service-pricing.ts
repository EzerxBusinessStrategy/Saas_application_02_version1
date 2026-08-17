export type PricedClientServiceTask = {
  rateAmount: number;
};

export type ScheduledClientServiceTask = PricedClientServiceTask & {
  plannedDueAt?: string | null;
  status?: string;
};

const CLOSED_TASK_STATUSES = new Set(["completed", "cancelled"]);

/**
 * The discount comes only from the percent the tenant entered when accepting
 * the request. Invoice-level discounts are intentionally not mixed in here.
 */
export function summarizeClientServicePricing(
  tasks: readonly PricedClientServiceTask[],
  discountPercent: number = 0,
) {
  const taskTotal = roundMoney(
    tasks.reduce((sum, task) => sum + finiteAmount(task.rateAmount), 0),
  );
  const percent = clampPercent(discountPercent);
  const discountAmount = taskTotal > 0 && percent > 0 ? roundMoney((taskTotal * percent) / 100) : 0;
  const amountDue = roundMoney(Math.max(0, taskTotal - discountAmount));
  return {
    taskTotal,
    discountAmount,
    discountPercent: discountAmount > 0 ? percent : 0,
    amountDue,
  };
}

export function summarizeClientServiceSchedule(
  tasks: readonly ScheduledClientServiceTask[],
  discountPercent: number = 0,
  now: Date = new Date(),
) {
  const thisMonthKey = utcMonthKey(now);
  const nextMonthKey = utcMonthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
  return {
    ...summarizeClientServicePricing(tasks, discountPercent),
    thisMonthKey,
    nextMonthKey,
    thisMonthDue: sumPayableInMonth(tasks, thisMonthKey),
    nextMonthDue: sumPayableInMonth(tasks, nextMonthKey),
  };
}

export function taskYearMonth(plannedDueAt: string | null | undefined) {
  if (!plannedDueAt) return null;
  const dueAt = new Date(plannedDueAt);
  if (Number.isNaN(dueAt.getTime())) return null;
  return utcMonthKey(dueAt);
}

export function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month) return yearMonth;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDiscountPercent(value: number) {
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}%`;
}

function sumPayableInMonth(tasks: readonly ScheduledClientServiceTask[], yearMonth: string) {
  return roundMoney(
    tasks.reduce((sum, task) => {
      if (CLOSED_TASK_STATUSES.has(task.status ?? "")) return sum;
      if (taskYearMonth(task.plannedDueAt) !== yearMonth) return sum;
      return sum + finiteAmount(task.rateAmount);
    }, 0),
  );
}

function utcMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, roundMoney(Number(value))));
}

function finiteAmount(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
