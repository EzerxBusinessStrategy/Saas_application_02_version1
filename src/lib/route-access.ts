import type { Permission, Workspace } from "@/types/domain";

export const sectionAccess: Record<
  string,
  { workspaces: Workspace[]; permissions?: Permission[] }
> = {
  tasks: {
    workspaces: ["admin", "manager", "employee", "client"],
    permissions: ["task.read", "task.read.assigned"],
  },
  employees: { workspaces: ["admin", "manager"] },
  "employee-performance": {
    workspaces: ["admin"],
    permissions: ["employee.read"],
  },
  clients: {
    workspaces: ["admin", "manager", "employee", "client"],
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
    workspaces: ["admin", "manager"],
    permissions: ["work_group.manage"],
  },
  documents: {
    workspaces: ["admin", "manager", "employee"],
    permissions: ["document.read"],
  },
  invoices: { workspaces: ["admin", "manager", "client"] },
  payments: { workspaces: ["admin", "client"] },
  agreements: { workspaces: ["admin", "client"] },
  reports: {
    workspaces: ["super-admin"],
    permissions: ["report.read"],
  },
  "audit-log": {
    workspaces: ["super-admin", "admin"],
    permissions: ["audit_log.read"],
  },
  branding: { workspaces: ["admin"], permissions: ["branding.manage"] },
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
  account: { workspaces: ["super-admin"] },
  managers: { workspaces: ["admin"], permissions: ["employee.read"] },
  settings: { workspaces: ["admin"], permissions: ["client.update"] },
  reviews: {
    workspaces: ["manager"],
    permissions: ["work_log.review.assigned_group"],
  },
  approvals: {
    workspaces: ["manager"],
    permissions: ["task.update.assigned_group"],
  },
  workload: { workspaces: ["manager"], permissions: ["task.read.assigned"] },
  "manager-reports": {
    workspaces: ["manager"],
    permissions: ["task.read.assigned"],
  },
  "work-logs": {
    workspaces: ["employee"],
    permissions: ["work_log.create.self"],
  },
  timesheet: {
    workspaces: ["employee"],
    permissions: ["work_log.create.self"],
  },
  calendar: { workspaces: ["employee"], permissions: ["task.read.assigned"] },
  achievements: {
    workspaces: ["employee"],
    permissions: ["task.read.assigned"],
  },
  recognition: {
    workspaces: ["manager", "employee"],
    permissions: ["task.read.assigned"],
  },
  preferences: {
    workspaces: ["employee"],
    permissions: ["task.read.assigned"],
  },
  services: {
    workspaces: ["admin", "client"],
    permissions: ["client.read", "client.read.assigned"],
  },
  requests: { workspaces: ["client"], permissions: ["client.read.assigned"] },
  deliverables: {
    workspaces: ["client"],
    permissions: ["client.read.assigned"],
  },
  notifications: { workspaces: ["manager", "employee"] },
  profile: { workspaces: ["manager", "employee", "client"] },
};
