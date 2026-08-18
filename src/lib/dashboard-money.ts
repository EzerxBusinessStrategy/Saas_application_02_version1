const LAKH = 100_000;
const CRORE = 10_000_000;

function parseAmount(amount: string | number): number {
  const value = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(value) ? value : 0;
}

function formatExactIndianMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyCode} ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

function formatCompactIndianMoney(amount: number, currencyCode: string): string {
  if (currencyCode !== "INR") {
    return formatExactIndianMoney(amount, currencyCode);
  }

  const absolute = Math.abs(amount);
  if (absolute >= CRORE) {
    const value = amount / CRORE;
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: absolute >= CRORE * 10 ? 1 : 2,
    }).format(value);
    return `₹${formatted}Cr`;
  }

  if (absolute >= LAKH) {
    const value = amount / LAKH;
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: absolute >= LAKH * 10 ? 1 : 2,
    }).format(value);
    return `₹${formatted}L`;
  }

  return formatExactIndianMoney(amount, currencyCode);
}

export function formatDashboardMoney(
  amount: string | number,
  currencyCode: string,
): { display: string; exact: string } {
  const numeric = parseAmount(amount);
  const exact = formatExactIndianMoney(numeric, currencyCode);
  const display =
    currencyCode === "INR" && Math.abs(numeric) >= LAKH
      ? formatCompactIndianMoney(numeric, currencyCode)
      : exact;

  return { display, exact };
}
