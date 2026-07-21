import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import type { Permission, Role } from "@/types/domain";

export function PermissionBoundary({
  role,
  permission,
  children,
}: {
  role: Role;
  permission: Permission;
  children?: ReactNode;
}) {
  return hasPermission(role, permission) ? (
    children
  ) : (
    <div className="grid min-h-48 place-items-center rounded-[var(--radius-card)] border border-dashed p-6 text-center">
      <div>
        <ShieldAlert className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="font-medium">You don&apos;t have access to this area</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask your tenant administrator if you need this permission.
        </p>
      </div>
    </div>
  );
}
