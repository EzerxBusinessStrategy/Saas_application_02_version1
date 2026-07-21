import type {
  Notification,
  TenantContext,
  WorkspaceOption,
} from "@/types/app-shell";

export const tenantContexts: TenantContext[] = [
  {
    id: "platform",
    name: "Platform context",
    status: "active",
  },
  {
    id: "tenant-acme",
    name: "Acme Operations",
    status: "active",
  },
  {
    id: "tenant-northstar",
    name: "Northstar Laboratory and Research Services",
    status: "active",
  },
  {
    id: "tenant-bayside",
    name: "Bayside Health",
    status: "active",
  },
  {
    id: "tenant-wellspring",
    name: "Wellspring Cooperative",
    status: "active",
  },
  {
    id: "tenant-everline",
    name: "Everline Tax Advisory",
    status: "active",
  },
  {
    id: "tenant-summit",
    name: "Summit Compliance",
    status: "active",
  },
  {
    id: "tenant-cascade",
    name: "Cascade Accountancy",
    status: "suspended",
  },
  {
    id: "tenant-harbor",
    name: "Harbor Operations",
    status: "active",
  },
];

export const workspaceOptions: WorkspaceOption[] = [
  { value: "super-admin", label: "Platform" },
  { value: "admin", label: "Tenant administration" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client portal" },
];

export const notificationFixtures: Notification[] = [
  {
    id: "notification-1",
    title: "Two tenant access reviews are due this week",
    description: "Review tenant access and delivery capacity.",
    createdAt: "12 minutes ago",
    href: "/super-admin/reports",
    read: false,
  },
  {
    id: "notification-2",
    title: "SLA risk reported for Acme Operations",
    description: "One client work group requires attention.",
    createdAt: "2 hours ago",
    href: "/super-admin/audit-log",
    read: false,
  },
  {
    id: "notification-3",
    title: "Monthly platform report is ready",
    description: "Tenant health and delivery data has been refreshed.",
    createdAt: "Yesterday",
    href: "/super-admin/reports",
    read: true,
  },
];
