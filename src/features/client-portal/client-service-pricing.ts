export type PricedClientServiceTask = {
  rateAmount: number;
  discountAmount?: number;
};

export type ScheduledClientServiceTask = PricedClientServiceTask & {
  plannedDueAt?: string | null;
  status?: string;
};

const CLOSED_TASK_STATUSES = new Set(["completed", "cancelled"]);

export function summarizeClientServicePricing(tasks: readonly PricedClientServiceTask[]) {
  const taskTotal = roundMoney(
    tasks.reduce((sum, task) => sum + finiteAmount(task.rateAmount), 0),
  );
  const discountAmount = roundMoney(
    tasks.reduce((sum, task) => sum + finiteAmount(task.discountAmount), 0),
  );
  const amountDue = roundMoney(Math.max(0, taskTotal - discountAmount));
  const discountPercent =
    taskTotal > 0 && discountAmount > 0
      ? Math.round((discountAmount / taskTotal) * 10_000) / 100
      : 0;
  return { taskTotal, discountAmount, discountPercent, amountDue };
}

export function summarizeClientServiceSchedule(
  tasks: readonly ScheduledClientServiceTask[],
  now: Date = new Date(),
) {
  const thisMonthKey = utcMonthKey(now);
  const nextMonthKey = utcMonthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
  return {
    ...summarizeClientServicePricing(tasks),
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

function finiteAmount(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
