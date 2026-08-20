"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatIndiaDateTime } from "@/lib/india-time";
import type { Tenant } from "@/types/administration";
import {
  canReactivateTenant,
  canRevokeTenant,
  canSuspendTenant,
  tenantLifecycleStatus,
} from "@/components/administration/tenant-lifecycle";

export function TenantPreviewDialog({
  tenant,
  open,
  onOpenChange,
  onSuspend,
  onRemove,
  children,
}: {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuspend: () => void;
  onRemove: () => void;
  children?: ReactNode;
}) {
  if (!tenant) return null;
  const administrator = tenant.tenantAdministrator;
  const lastLogin = administrator?.lastLoginAt;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Tenant details for ${tenant.name}`}
        description="Organisation status, administrator access, and lifecycle actions."
        className="max-w-md"
      >
        <div className="pr-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tenant details
          </p>
          <h2 className="mt-1 font-semibold">{tenant.name}</h2>
          {tenant.code ? (
            <p className="mt-1 text-sm text-muted-foreground">{tenant.code}</p>
          ) : null}
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={tenantLifecycleStatus(tenant)} className="whitespace-nowrap" />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tenant administrator</dt>
              <dd className="mt-1 font-medium">{administrator?.name || tenant.owner.name || "Not assigned"}</dd>
              <dd className="text-muted-foreground">{administrator?.email || tenant.owner.email || "No email recorded"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Administrator access</dt>
              <dd className="mt-1">
                {lastLogin
                  ? `Logged in · ${formatIndiaDateTime(lastLogin)}`
                  : "No login recorded"}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-muted-foreground">Employees</dt>
                <dd className="mt-1">{tenant.employeeCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Clients</dt>
                <dd className="mt-1">{tenant.clientCount}</dd>
              </div>
            </div>
            {tenant.createdAt ? (
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1">{formatIndiaDateTime(tenant.createdAt)}</dd>
              </div>
            ) : null}
            {children}
          </dl>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {canSuspendTenant(tenant) || canReactivateTenant(tenant) ? (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onSuspend();
                }}
              >
                {tenant.status === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
            ) : null}
            {canRevokeTenant(tenant) ? (
              <Button
                className="bg-danger hover:bg-danger/90"
                onClick={() => {
                  onOpenChange(false);
                  onRemove();
                }}
              >
                Remove
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
