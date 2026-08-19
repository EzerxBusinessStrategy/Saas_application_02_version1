export type ClientRequestStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export function formatClientDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatClientMoney(amount: number, currencyCode: string) {
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

const LAKH = 100_000;
const CRORE = 10_000_000;

export function formatClientMoneyCompact(amount: number, currencyCode: string) {
  const exact = formatClientMoney(amount, currencyCode);
  if (currencyCode !== "INR") return { display: exact, exact };

  const absolute = Math.abs(amount);
  if (absolute >= CRORE) {
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: absolute >= CRORE * 10 ? 1 : 2,
    }).format(amount / CRORE);
    return { display: `₹${formatted}Cr`, exact };
  }
  if (absolute >= LAKH) {
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: absolute >= LAKH * 10 ? 1 : 2,
    }).format(amount / LAKH);
    return { display: `₹${formatted}L`, exact };
  }
  if (absolute >= 1_000) {
    const value = amount / 1_000;
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 1,
    }).format(value);
    return { display: `₹${formatted}K`, exact };
  }
  return { display: exact, exact };
}

export function isOpenClientTask(status: string) {
  const key = status.trim().toLowerCase();
  return key !== "completed" && key !== "cancelled" && key !== "canceled" && key !== "approved";
}

export function clientTaskListStatus(status: string) {
  const key = status.trim().toLowerCase().replace(/[_-]+/g, " ");
  switch (key) {
    case "completed":
    case "approved":
      return "Completed";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "in progress":
    case "submitted":
    case "manager review":
    case "tenant approval":
    case "returned":
      return "Open";
    default:
      return "Scheduled";
  }
}

export function isClientTaskDueSoon(
  plannedDueAt: string | null | undefined,
  status: string,
  now: Date = new Date(),
) {
  if (!plannedDueAt || !isOpenClientTask(status)) return false;
  const due = new Date(plannedDueAt);
  if (Number.isNaN(due.getTime())) return false;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const diffDays = Math.round((dueDay - start) / 86_400_000);
  return diffDays >= 0 && diffDays <= 7;
}

export function clientServiceTitles(engagementName: string, serviceName: string) {
  const engagement = engagementName.trim();
  const service = serviceName.trim();
  const primary = service || engagement;
  const secondary = engagement && service && engagement !== service ? engagement : null;
  return { primary, secondary };
}

export function employeeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function humanizeClientStatus(status: string) {
  const key = status.trim().toLowerCase().replace(/[_-]+/g, " ");
  switch (key) {
    case "complete":
    case "completed":
    case "resolved":
      return "Completed";
    case "accepted":
    case "approved":
    case "converted":
      return "Approved";
    case "pending":
    case "submitted":
    case "open":
      return "Pending";
    case "in progress":
    case "in review":
    case "reviewed":
      return "In review";
    case "rejected":
      return "Rejected";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "active":
      return "Active";
    default:
      return key.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function clientRequestStatusTone(status: string): ClientRequestStatusTone {
  const label = humanizeClientStatus(status);
  switch (label) {
    case "Completed":
    case "Approved":
      return "success";
    case "In review":
      return "info";
    case "Rejected":
      return "danger";
    case "Cancelled":
      return "neutral";
    case "Pending":
      return "warning";
    default:
      return "neutral";
  }
}

export function nextOpenClientTask<T extends {
  status: string;
  plannedDueAt: string | null;
}>(tasks: readonly T[], nextDueAt: string | null): T | null {
  const open = tasks.filter((task) => {
    const status = task.status.trim().toLowerCase();
    return status !== "completed" && status !== "cancelled" && status !== "canceled";
  });
  if (!open.length) return null;
  if (nextDueAt) {
    const matched = open.find((task) => task.plannedDueAt === nextDueAt);
    if (matched) return matched;
  }
  const ranked = [...open].sort((left, right) => {
    const leftTime = left.plannedDueAt ? Date.parse(left.plannedDueAt) : Number.POSITIVE_INFINITY;
    const rightTime = right.plannedDueAt ? Date.parse(right.plannedDueAt) : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  });
  return ranked[0] ?? null;
}
