import type { Permission, Role } from "@/types/domain";

export const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "tenant.read",
    "tenant.create",
    "tenant.update",
    "audit_log.read",
    "platform.configuration.read",
    "platform.configuration.update",
    "report.read",
  ],
  TENANT_OWNER: [
    "tenant.read",
    "tenant.update",
    "employee.read",
    "client.read",
    "client.create",
    "client.update",
    "engagement.manage",
    "work_group.manage",
    "task.read",
    "task.create",
    "invoice.create",
    "invoice.approve",
    "invoice.send",
    "document.read",
    "document.publish",
    "report.read",
    "branding.manage",
    "audit_log.read",
  ],
  TENANT_ADMIN: [
    "employee.read",
    "client.read",
    "client.create",
    "client.update",
    "engagement.manage",
    "work_group.manage",
    "task.read",
    "task.create",
    "invoice.create",
    "document.read",
    "document.publish",
    "report.read",
  ],
  FINANCE_USER: [
    "client.read",
    "invoice.create",
    "invoice.approve",
    "invoice.send",
    "report.read",
  ],
  HR_OPERATIONS_USER: [
    "employee.read",
    "client.read",
    "work_group.manage",
    "task.read",
    "report.read",
  ],
  MANAGER: [
    "client.read",
    "client.read.assigned",
    "task.read.assigned",
    "task.create",
    "task.update.assigned_group",
    "task.update_status.assigned",
    "work_log.review.assigned_group",
    "document.read",
    "invoice.create",
  ],
  EMPLOYEE: [
    "task.read.assigned",
    "task.update_status.assigned",
    "work_log.create.self",
    "document.read",
  ],
  CLIENT_USER: ["client.read.assigned", "document.read"],
};

export const hasPermission = (role: Role, permission?: Permission) =>
  !permission || rolePermissions[role].includes(permission);

export const hasAnyPermission = (role: Role, permissions?: Permission[]) =>
  !permissions?.length ||
  permissions.some((permission) => hasPermission(role, permission));
