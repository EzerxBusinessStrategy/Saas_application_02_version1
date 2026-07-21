import type { ReactNode } from "react";
import { PermissionBoundary } from "@/components/shared/permission-boundary";
import { hasAnyPermission } from "@/lib/permissions";
import type { Permission, Role } from "@/types/domain";

export function FeatureBoundary({
  role,
  permissions,
  children,
}: {
  role: Role;
  permissions: Permission[];
  children: ReactNode;
}) {
  return hasAnyPermission(role, permissions) ? (
    children
  ) : (
    <PermissionBoundary role={role} permission={permissions[0]} />
  );
}
