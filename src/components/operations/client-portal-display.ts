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
