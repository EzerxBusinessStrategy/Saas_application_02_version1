export type PricedClientServiceTask = {
  rateAmount: number;
};

/**
 * The discount shown to the client comes only from the percent the tenant
 * entered when accepting the request (stored on the engagement service
 * configuration). Invoice-level discounts are intentionally not mixed in.
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
