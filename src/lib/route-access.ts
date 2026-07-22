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
  clients: {
    workspaces: ["admin", "manager", "client"],
    permissions: ["client.read", "client.read.assigned"],
  },
  "work-groups": {
    workspaces: ["admin", "manager"],
    permissions: ["work_group.manage"],
  },
  documents: {
    workspaces: ["admin", "manager", "employee", "client"],
    permissions: ["document.read"],
  },
  invoices: { workspaces: ["admin", "client"] },
  payments: { workspaces: ["admin", "client"] },
  agreements: { workspaces: ["admin", "client"] },
  reports: {
    workspaces: ["super-admin", "admin"],
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
    permissions: ["tenant.update"],
  },
  "support-access": {
    workspaces: ["super-admin"],
    permissions: ["tenant.update"],
  },
  account: { workspaces: ["super-admin"] },
  managers: { workspaces: ["admin"], permissions: ["employee.read"] },
  organisation: { workspaces: ["admin"], permissions: ["employee.read"] },
  settings: { workspaces: ["admin"], permissions: ["client.update"] },
  gamification: { workspaces: ["admin"], permissions: ["client.update"] },
  tickets: { workspaces: ["admin", "manager"] },
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
  services: { workspaces: ["client"], permissions: ["client.read.assigned"] },
  requests: { workspaces: ["client"], permissions: ["client.read.assigned"] },
  support: { workspaces: ["client"], permissions: ["client.read.assigned"] },
  onboarding: { workspaces: ["client"], permissions: ["client.read.assigned"] },
  deliverables: {
    workspaces: ["client"],
    permissions: ["client.read.assigned"],
  },
  notifications: { workspaces: ["manager", "employee", "client"] },
  profile: { workspaces: ["manager", "employee", "client"] },
};
