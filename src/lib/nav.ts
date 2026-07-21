import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  Handshake,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";
import type { NavigationItem } from "@/types/navigation";
import type { Workspace } from "@/types/domain";

const common: NavigationItem[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  {
    label: "Delivery",
    icon: CheckSquare,
    children: [
      {
        label: "Tasks",
        href: "/tasks",
        icon: CheckSquare,
        permissions: ["task.read", "task.read.assigned"],
      },
      {
        label: "Clients",
        href: "/clients",
        icon: Building2,
        permissions: ["client.read", "client.read.assigned"],
      },
      {
        label: "Work groups",
        href: "/work-groups",
        icon: Users,
        permissions: ["work_group.manage"],
      },
    ],
  },
  {
    label: "Operations",
    icon: ClipboardList,
    children: [
      {
        label: "Employees",
        href: "/employees",
        icon: Users,
        permissions: ["employee.read"],
      },
      {
        label: "Documents",
        href: "/documents",
        icon: FileText,
        permissions: ["document.read"],
      },
      {
        label: "Invoices",
        href: "/invoices",
        icon: ReceiptText,
        permissions: ["invoice.create"],
      },
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        permissions: ["report.read"],
      },
      {
        label: "Audit log",
        href: "/audit-log",
        icon: ClipboardList,
        permissions: ["audit_log.read"],
      },
      {
        label: "Branding",
        href: "/branding",
        icon: Settings,
        permissions: ["branding.manage"],
      },
      {
        label: "Managers",
        href: "/managers",
        icon: Users,
        permissions: ["employee.read"],
      },
      {
        label: "Organisation",
        href: "/organisation",
        icon: Building2,
        permissions: ["employee.read"],
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        permissions: ["client.update"],
      },
    ],
  },
  {
    label: "Platform",
    icon: Building2,
    children: [
      {
        label: "Tenants",
        href: "/tenants",
        icon: Building2,
        permissions: ["tenant.read"],
      },
      {
        label: "Platform configuration",
        href: "/platform-settings",
        icon: Settings,
        permissions: ["tenant.update"],
      },
      {
        label: "Support access",
        href: "/support-access",
        icon: ClipboardList,
        permissions: ["tenant.update"],
      },
    ],
  },
];

const superAdminItems = new Set([
  "Dashboard",
  "Tenants",
  "Reports",
  "Audit log",
  "Platform configuration",
  "Support access",
]);
const tenantAdminOnlyItems = new Set(["Managers", "Organisation", "Settings"]);
const platformOnlyItems = new Set([
  "Tenants",
  "Platform configuration",
  "Support access",
]);

const managerNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Assigned clients", href: "/clients", icon: Building2 },
  { label: "Work groups", href: "/work-groups", icon: Users },
  { label: "Assigned employees", href: "/employees", icon: Users },
  { label: "Review queue", href: "/reviews", icon: ClipboardList },
  { label: "Approval queue", href: "/approvals", icon: CheckSquare },
  { label: "Team workload", href: "/workload", icon: BarChart3 },
  { label: "Manager reports", href: "/manager-reports", icon: BarChart3 },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: Users },
];

const employeeNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  { label: "My tasks", href: "/tasks", icon: CheckSquare },
  { label: "Work logs", href: "/work-logs", icon: ClipboardList },
  { label: "Timesheet", href: "/timesheet", icon: CalendarDays },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: Users },
];

const clientNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  { label: "Active services", href: "/services", icon: Handshake },
  { label: "Requests", href: "/requests", icon: ClipboardList },
  { label: "Invoices", href: "/invoices", icon: ReceiptText },
  { label: "Payments", href: "/payments", icon: ReceiptText },
  { label: "Agreements", href: "/agreements", icon: FileText },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Support", href: "/support", icon: ClipboardList },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: Users },
];

function filterForWorkspace(
  items: NavigationItem[],
  workspace: Workspace,
): NavigationItem[] {
  return items.flatMap((item) => {
    const children = item.children
      ? filterForWorkspace(item.children, workspace)
      : undefined;
    const allowed =
      workspace === "super-admin"
        ? superAdminItems.has(item.label)
        : workspace === "admin"
          ? !platformOnlyItems.has(item.label)
          : !platformOnlyItems.has(item.label) &&
            !tenantAdminOnlyItems.has(item.label);
    if (item.children) return children?.length ? [{ ...item, children }] : [];
    return allowed ? [{ ...item }] : [];
  });
}

export const flattenNavigation = (items: NavigationItem[]): NavigationItem[] =>
  items.flatMap((item) => [
    item,
    ...(item.children ? flattenNavigation(item.children) : []),
  ]);

export const navigationFor = (workspace: Workspace) =>
  workspace === "manager"
    ? managerNavigation
    : workspace === "employee"
      ? employeeNavigation
      : workspace === "client"
        ? clientNavigation
        : filterForWorkspace(common, workspace);
