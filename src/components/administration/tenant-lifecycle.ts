import type { Tenant } from "@/types/administration";

export const suspensionDurations = [
  { value: "24h", label: "24 hours" },
  { value: "48h", label: "48 hours" },
  { value: "72h", label: "72 hours" },
  { value: "96h", label: "96 hours" },
  { value: "1w", label: "1 week" },
  { value: "1m", label: "1 month" },
  { value: "6m", label: "6 months" },
] as const;

export type SuspensionDuration = (typeof suspensionDurations)[number]["value"];

export const canSuspendTenant = (tenant: Pick<Tenant, "status">) =>
  tenant.status === "active" || tenant.status === "pending_activation";

export const canReactivateTenant = (tenant: Pick<Tenant, "status">) =>
  tenant.status === "suspended";

export const canRevokeTenant = (tenant: Pick<Tenant, "status">) =>
  tenant.status === "active" || tenant.status === "suspended" || tenant.status === "pending_activation";

export function tenantLifecycleStatus(tenant: Tenant): Tenant["status"] | "not_logged_in" {
  if (tenant.status === "active" || tenant.status === "pending_activation") {
    return tenant.tenantAdministrator?.lastLoginAt ? "active" : "not_logged_in";
  }
  return tenant.status;
}
