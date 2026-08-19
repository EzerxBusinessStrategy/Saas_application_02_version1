import { humanizeClientStatus } from "@/components/operations/client-portal-display";

export type ClientRequestStatusFilter = "waiting" | "accepted" | "rejected";
export type ClientInvoiceBalanceFilter = "outstanding" | "paid";

export const clientRequestStatusFilterOptions = [
  { id: "waiting", name: "Waiting" },
  { id: "accepted", name: "Accepted" },
  { id: "rejected", name: "Rejected" },
] as const;

export const clientInvoiceBalanceFilterOptions = [
  { id: "outstanding", name: "Outstanding" },
  { id: "paid", name: "Paid" },
] as const;

export const clientDeliverableDecisionOptions = [
  { id: "pending", name: "Pending" },
  { id: "approved", name: "Approved" },
  { id: "rejected", name: "Rejected" },
] as const;

export const clientDeliverableAccessOptions = [
  { id: "active", name: "Active" },
  { id: "expired", name: "Expired" },
] as const;

export function clientRequestStatusFilter(status: string): ClientRequestStatusFilter | "other" {
  const key = status.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (
    key === "pending" ||
    key === "submitted" ||
    key === "open" ||
    key === "under review" ||
    key === "in review" ||
    key === "in progress" ||
    key === "reviewed"
  ) {
    return "waiting";
  }
  if (
    key === "accepted" ||
    key === "approved" ||
    key === "converted" ||
    key === "complete" ||
    key === "completed" ||
    key === "resolved"
  ) {
    return "accepted";
  }
  if (key === "rejected") return "rejected";
  return "other";
}

export function matchesClientRequestListFilters(
  item: { title: string; serviceName: string; status: string },
  filters: { search: string; status: string },
): boolean {
  if (filters.status && clientRequestStatusFilter(item.status) !== filters.status) return false;
  const needle = filters.search.trim().toLowerCase();
  if (!needle) return true;
  return [item.title, item.serviceName].join(" ").toLowerCase().includes(needle);
}

export function matchesClientInvoiceListFilters(
  invoice: {
    invoiceNumber: string;
    serviceName: string | null;
    taskTitle: string | null;
    status: string;
    outstandingAmount: number;
  },
  filters: { search: string; balance: string; status: string },
): boolean {
  if (filters.balance === "outstanding" && invoice.outstandingAmount <= 0) return false;
  if (filters.balance === "paid" && invoice.outstandingAmount > 0) return false;
  if (filters.status && invoice.status !== filters.status) return false;
  const needle = filters.search.trim().toLowerCase();
  if (!needle) return true;
  return [invoice.invoiceNumber, invoice.serviceName ?? "", invoice.taskTitle ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function matchesClientDeliverableListFilters(
  item: {
    title: string;
    fileName: string;
    category: string;
    clientDecisionStatus: "pending" | "approved" | "rejected";
    accessStatus: "active" | "expired";
  },
  filters: { search: string; decision: string; category: string; access: string },
): boolean {
  if (filters.decision && item.clientDecisionStatus !== filters.decision) return false;
  if (filters.category && item.category !== filters.category) return false;
  if (filters.access && item.accessStatus !== filters.access) return false;
  const needle = filters.search.trim().toLowerCase();
  if (!needle) return true;
  return [item.title, item.fileName].join(" ").toLowerCase().includes(needle);
}

export function uniqueNamedOptions(values: readonly string[]): readonly { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const value of values) {
    const id = value.trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, humanizeClientStatus(id));
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
}
