import {
  allocatedWorkStatusGroups,
  type AllocatedWorkStatusGroup,
} from "@/features/tenant-admin/api/open-tasks-api";

export type AllocatedWorkRangeMode = "due" | "kpi";

export type AllocatedWorkPageFilters = {
  clientId: string;
  employeeId: string;
  serviceId: string;
  status: AllocatedWorkStatusGroup;
  from: string;
  to: string;
  atRisk: boolean;
  range: AllocatedWorkRangeMode;
};

function isStatusGroup(value: string | null): value is AllocatedWorkStatusGroup {
  return allocatedWorkStatusGroups.includes(value as AllocatedWorkStatusGroup);
}

export function parseAllocatedWorkFilters(
  searchParams: Pick<URLSearchParams, "get">,
): AllocatedWorkPageFilters {
  const statusParam = searchParams.get("status");
  return {
    clientId: searchParams.get("clientId") ?? "",
    employeeId: searchParams.get("employeeId") ?? "",
    serviceId: searchParams.get("serviceId") ?? "",
    status: isStatusGroup(statusParam) ? statusParam : "all",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    atRisk: searchParams.get("atRisk") === "true",
    range: searchParams.get("range") === "kpi" ? "kpi" : "due",
  };
}

export function serializeAllocatedWorkFilters(filters: AllocatedWorkPageFilters): string {
  const search = new URLSearchParams();
  if (filters.clientId) search.set("clientId", filters.clientId);
  if (filters.employeeId) search.set("employeeId", filters.employeeId);
  if (filters.serviceId) search.set("serviceId", filters.serviceId);
  if (filters.status !== "all") search.set("status", filters.status);
  if (filters.from && filters.to) {
    search.set("from", filters.from);
    search.set("to", filters.to);
    if (filters.range === "kpi") search.set("range", "kpi");
  }
  if (filters.atRisk) search.set("atRisk", "true");
  return search.toString();
}
