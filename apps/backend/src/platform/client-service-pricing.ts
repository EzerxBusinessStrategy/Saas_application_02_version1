export type PricedClientServiceTask = {
  rateAmount: number;
  discountAmount?: number;
};

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

function finiteAmount(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
