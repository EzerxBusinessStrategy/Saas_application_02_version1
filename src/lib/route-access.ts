import type { Permission, Workspace } from "@/types/domain";

export const sectionAccess: Record<
  string,
  { workspaces: Workspace[]; permissions?: Permission[] }
> = {
  tasks: {
    workspaces: ["admin", "employee"],
    permissions: ["task.read", "task.read.assigned"],
  },
  employees: { workspaces: ["admin"] },
  "employee-performance": {
    workspaces: ["admin"],
    permissions: ["employee.read"],
  },
  clients: {
    workspaces: ["admin", "employee", "client"],
    permissions: ["client.read", "client.read.assigned"],
  },
  "assign-task": {
    workspaces: ["employee"],
    permissions: ["task.create"],
  },
  "task-reviews": {
    workspaces: ["employee"],
    permissions: ["work_log.review.assigned_group"],
  },
  "work-groups": {
    workspaces: ["admin"],
    permissions: ["work_group.manage"],
  },
  documents: {
    workspaces: ["admin", "employee"],
    permissions: ["document.read"],
  },
  invoices: { workspaces: ["admin", "client"] },
  agreements: { workspaces: ["admin"] },
  reports: {
    workspaces: ["super-admin"],
    permissions: ["report.read"],
  },
  "audit-log": {
    workspaces: ["super-admin", "admin"],
    permissions: ["audit_log.read"],
  },
  tenants: { workspaces: ["super-admin"], permissions: ["tenant.read"] },
  "platform-settings": {
    workspaces: ["super-admin"],
    permissions: ["platform.configuration.update"],
  },
  "tenant-analytics": {
    workspaces: ["super-admin"],
    permissions: ["report.read"],
  },
  "tenant-password": {
    workspaces: ["super-admin"],
    permissions: ["tenant.update"],
  },
  managers: { workspaces: ["admin"], permissions: ["employee.read"] },
  services: {
    workspaces: ["admin", "client"],
    permissions: ["client.read", "client.read.assigned"],
  },
  requests: { workspaces: ["client"], permissions: ["client.read.assigned"] },
  deliverables: {
    workspaces: ["client"],
    permissions: ["client.read.assigned"],
  },
  notifications: { workspaces: ["employee"] },
  profile: { workspaces: ["employee", "client"] },
};
