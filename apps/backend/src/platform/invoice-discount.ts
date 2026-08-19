export function calculateDiscount(
  grossAmount: number,
  type: "percentage" | "fixed" | undefined,
  value: number,
): number {
  if (!type || value <= 0) return 0;
  const amount = type === "percentage" ? grossAmount * (value / 100) : value;
  return Math.min(grossAmount, roundMoney(amount));
}

export function toStoredDiscountType(
  type: "percentage" | "fixed" | undefined,
): "percentage" | "fixed_amount" | null {
  if (type === "percentage") return "percentage";
  if (type === "fixed") return "fixed_amount";
  return null;
}

export function distributeDiscount(grossAmounts: readonly number[], discountTotal: number): number[] {
  if (grossAmounts.length === 0) return [];
  const subtotalCents = grossAmounts.reduce((sum, amount) => sum + toCents(amount), 0);
  const discountCents = Math.min(Math.max(0, toCents(discountTotal)), subtotalCents);
  if (discountCents <= 0 || subtotalCents <= 0) return grossAmounts.map(() => 0);

  const shares = grossAmounts.map((amount) => (toCents(amount) * discountCents) / subtotalCents);
  const floors = shares.map((share) => Math.floor(share));
  let remainder = discountCents - floors.reduce((sum, value) => sum + value, 0);
  const order = shares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((left, right) => right.fraction - left.fraction);

  const result = [...floors];
  for (const item of order) {
    if (remainder <= 0) break;
    result[item.index] += 1;
    remainder -= 1;
  }
  return result.map(fromCents);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return value / 100;
}
