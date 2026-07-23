import type {
  Metric,
  Task,
  TenantTheme,
  User,
  Workspace,
} from "@/types/domain";
import { rolePermissions } from "@/lib/permissions";

export const tenantTheme: TenantTheme = {
  name: "SaaS App",
  primary: "#2563eb",
};
const personas: Record<
  Workspace,
  { title: string; subtitle: string; user: User; metrics: Metric[] }
> = {
  "super-admin": {
    title: "Platform overview",
    subtitle: "Tenant health across the platform",
    user: {
      name: "Maya Chen",
      email: "maya.chen@saasapp.example",
      initials: "MC",
      role: "SUPER_ADMIN",
      permissions: rolePermissions.SUPER_ADMIN,
    },
    metrics: [
      {
        label: "Active tenants",
        value: "48",
        change: "+4 this month",
        trend: "up",
      },
      {
        label: "Tenant reviews",
        value: "3",
        change: "Due this week",
        trend: "up",
      },
      { label: "Active users", value: "2,843" },
      { label: "Alerts", value: "3", trend: "down" },
    ],
  },
  admin: {
    title: "Operations command center",
    subtitle: "Delivery, capacity, and billing for SaaS App",
    user: {
      name: "Jordan Lee",
      email: "jordan.lee@saasapp.example",
      initials: "JL",
      role: "TENANT_ADMIN",
      permissions: rolePermissions.TENANT_ADMIN,
    },
    metrics: [
      {
        label: "Active clients",
        value: "24",
        change: "+2 this quarter",
        trend: "up",
      },
      { label: "Open tasks", value: "86" },
      { label: "Overdue tasks", value: "7", trend: "down" },
      { label: "Outstanding invoices", value: "$42.8k" },
    ],
  },
  manager: {
    title: "Team delivery",
    subtitle: "Priorities and approvals for your work groups",
    user: {
      name: "Avery Patel",
      email: "avery.patel@saasapp.example",
      initials: "AP",
      role: "MANAGER",
      permissions: rolePermissions.MANAGER,
    },
    metrics: [
      { label: "Work groups", value: "4" },
      { label: "Assigned employees", value: "18" },
      { label: "Awaiting review", value: "12" },
      { label: "SLA risks", value: "2", trend: "down" },
    ],
  },
  employee: {
    title: "My day",
    subtitle: "Keep work moving and make your progress visible",
    user: {
      name: "Riley Shah",
      email: "riley.shah@saasapp.example",
      initials: "RS",
      role: "EMPLOYEE",
      permissions: rolePermissions.EMPLOYEE,
    },
    metrics: [
      { label: "Due today", value: "3" },
      { label: "In progress", value: "2" },
      { label: "Hours logged", value: "5.5h" },
      { label: "Submitted", value: "4" },
    ],
  },
  client: {
    title: "Welcome to SaaS App",
    subtitle: "Your services, progress, and shared documents",
    user: {
      name: "Taylor Morgan",
      email: "taylor.morgan@saasapp.example",
      initials: "TM",
      role: "CLIENT_USER",
      permissions: rolePermissions.CLIENT_USER,
    },
    metrics: [
      { label: "Active services", value: "3" },
      { label: "Engagement progress", value: "72%" },
      { label: "Upcoming milestones", value: "2" },
      { label: "Open invoices", value: "$12.4k" },
    ],
  },
};
export const workspaceConfig = (workspace: Workspace) =>
  personas[workspace] ?? personas.admin;
export const workspaces: Workspace[] = [
  "super-admin",
  "admin",
  "manager",
  "employee",
  "client",
];
export const tasks: Task[] = [
  {
    id: "T-1042",
    title: "Confirm onboarding checklist",
    client: "Northstar Labs",
    group: "Implementation",
    assignee: "Riley Shah",
    priority: "High",
    status: "In progress",
    due: "Today",
  },
  {
    id: "T-1043",
    title: "Reconcile June service usage",
    client: "Northstar Labs",
    group: "Finance",
    assignee: "Avery Patel",
    priority: "Medium",
    status: "Review",
    due: "Tomorrow",
  },
  {
    id: "T-1044",
    title: "Publish monthly delivery report",
    client: "Wellspring Co.",
    group: "Delivery",
    assignee: "Jordan Lee",
    priority: "High",
    status: "To do",
    due: "Jul 24",
    blocked: true,
  },
  {
    id: "T-1045",
    title: "Archive signed agreement",
    client: "Bayside Health",
    group: "Operations",
    assignee: "Maya Chen",
    priority: "Low",
    status: "Done",
    due: "Jul 18",
  },
];
