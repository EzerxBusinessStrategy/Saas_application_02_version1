import type { AppLocale, AppTimezone } from "@/i18n/config";

export const roles = [
  "SUPER_ADMIN",
  "TENANT_OWNER",
  "TENANT_ADMIN",
  "FINANCE_USER",
  "HR_OPERATIONS_USER",
  "MANAGER",
  "EMPLOYEE",
  "CLIENT_USER",
] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "tenant.read",
  "tenant.create",
  "tenant.update",
  "employee.read",
  "client.read",
  "client.create",
  "client.update",
  "client.read.assigned",
  "engagement.manage",
  "work_group.manage",
  "task.read",
  "task.read.assigned",
  "task.create",
  "task.update.assigned_group",
  "task.update_status.assigned",
  "work_log.create.self",
  "work_log.review.assigned_group",
  "invoice.create",
  "invoice.approve",
  "invoice.send",
  "document.read",
  "document.publish",
  "report.read",
  "branding.manage",
  "audit_log.read",
  "platform.configuration.read",
  "platform.configuration.update",
] as const;
export type Permission = (typeof permissions)[number];
export type Workspace =
  | "super-admin"
  | "admin"
  | "manager"
  | "employee"
  | "client";
export type Status =
  | "on-track"
  | "at-risk"
  | "blocked"
  | "complete"
  | "pending";

export type TenantTheme = { name: string; primary: string; logo?: string };
export type User = {
  name: string;
  email: string;
  initials: string;
  role: Role;
  roles?: Role[];
  permissions: Permission[];
  preferences?: {
    locale: AppLocale;
    timezone: AppTimezone;
  };
};
export type Metric = {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "flat";
};
export type Task = {
  id: string;
  title: string;
  client: string;
  group: string;
  assignee: string;
  priority: "High" | "Medium" | "Low";
  status: "To do" | "In progress" | "Review" | "Done";
  due: string;
  blocked?: boolean;
};
export type Entity = {
  id: string;
  name: string;
  owner: string;
  status: Status;
  updated: string;
};
