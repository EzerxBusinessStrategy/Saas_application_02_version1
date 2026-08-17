import {
  BarChart3,
  Award,
  Building2,
  CheckSquare,
  CalendarDays,
  ClipboardList,
  FileText,
  Handshake,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Star,
  KeyRound,
  Users,
} from "lucide-react";
import type { NavigationItem } from "@/types/navigation";
import type { Workspace } from "@/types/domain";

const common: NavigationItem[] = [
  { label: "Dashboard", labelKey: "Navigation.dashboard", href: "", icon: LayoutDashboard },
  {
    label: "Delivery", labelKey: "Navigation.delivery",
    icon: CheckSquare,
    children: [
      {
        label: "Tasks", labelKey: "Navigation.tasks",
        href: "/tasks",
        icon: CheckSquare,
        permissions: ["task.read", "task.read.assigned"],
      },
      {
        label: "Calendar", labelKey: "Navigation.calendar",
        href: "/task-calendar",
        icon: CalendarDays,
        permissions: ["task.read"],
      },
      {
        label: "Clients", labelKey: "Navigation.clients",
        href: "/clients",
        icon: Building2,
        permissions: ["client.read", "client.read.assigned"],
      },
      {
        label: "Services", labelKey: "Navigation.services",
        href: "/services",
        icon: Handshake,
        permissions: ["client.read"],
      },
    ],
  },
  {
    label: "Operations", labelKey: "Navigation.operations",
    icon: ClipboardList,
    children: [
      {
        label: "Employees", labelKey: "Navigation.employees",
        href: "/employees",
        icon: Users,
        permissions: ["employee.read"],
      },
      {
        label: "Departments", labelKey: "Navigation.departments",
        href: "/departments",
        icon: Building2,
        permissions: ["employee.read"],
      },
      {
        label: "Employee Performance", labelKey: "Navigation.employeePerformance",
        href: "/employee-performance",
        icon: Award,
        permissions: ["employee.read"],
      },
      {
        label: "Documents", labelKey: "Navigation.documents",
        href: "/documents",
        icon: FileText,
        permissions: ["document.read"],
      },
      {
        label: "Invoices", labelKey: "Navigation.invoices",
        href: "/invoices",
        icon: ReceiptText,
        permissions: ["invoice.create"],
      },
      {
        label: "Agreements", labelKey: "Navigation.agreements",
        href: "/agreements",
        icon: FileText,
        permissions: ["document.read"],
      },
      {
        label: "Audit log", labelKey: "Navigation.auditLog",
        href: "/audit-log",
        icon: ClipboardList,
        permissions: ["audit_log.read"],
      },
      {
        label: "Feedback log", labelKey: "Navigation.feedbackLog",
        href: "/feedback-log",
        icon: Award,
        permissions: ["employee.read"],
      },
      {
        label: "Managers", labelKey: "Navigation.managers",
        href: "/managers",
        icon: Users,
        permissions: ["employee.read"],
      },
    ],
  },
  {
    label: "Platform", labelKey: "Workspace.platform",
    icon: Building2,
    children: [
      {
        label: "Tenant list", labelKey: "Navigation.tenantList",
        href: "/tenants",
        icon: Building2,
        permissions: ["tenant.read"],
      },
      {
        label: "Platform configuration", labelKey: "Navigation.platformConfiguration",
        href: "/platform-settings",
        icon: Settings,
        permissions: ["tenant.update"],
      },
      {
        label: "Tenant analytics", labelKey: "Navigation.tenantAnalytics",
        href: "/tenant-analytics",
        icon: BarChart3,
        permissions: ["report.read"],
      },
      {
        label: "Tenant password", labelKey: "Navigation.tenantPassword",
        href: "/tenant-password",
        icon: KeyRound,
        permissions: ["tenant.update"],
      },
    ],
  },
];

const superAdminItems = new Set([
  "Dashboard",
  "Tenant list",
  "Reports",
  "Audit log",
  "Platform configuration",
  "Tenant analytics",
  "Tenant password",
]);
const tenantAdminOnlyItems = new Set([
  "Managers",
  "Settings",
  "Employee Performance",
  "Task review",
  "Feedback log",
]);
const platformOnlyItems = new Set([
  "Tenant list",
  "Platform configuration",
  "Tenant analytics",
  "Tenant password",
]);

const employeeNavigation: NavigationItem[] = [
  { label: "Dashboard", labelKey: "Navigation.dashboard", href: "", icon: LayoutDashboard },
  { label: "My tasks", labelKey: "Navigation.myTasks", href: "/tasks", icon: CheckSquare },
  { label: "My feedback", labelKey: "Navigation.myFeedback", href: "/feedback", icon: Award },
  { label: "Documents", labelKey: "Navigation.documents", href: "/documents", icon: FileText },
  { label: "Profile", labelKey: "Navigation.profile", href: "/profile", icon: Users },
];

const employeeManagerNavigation: NavigationItem[] = [
  { label: "Clients", labelKey: "Navigation.clients", href: "/clients", icon: Building2, permissions: ["client.read"] },
  { label: "Assign Task", labelKey: "Navigation.assignTask", href: "/assign-task", icon: CheckSquare, permissions: ["task.create"] },
  { label: "Task Reviews", labelKey: "Navigation.taskReviews", href: "/task-reviews", icon: ClipboardList, permissions: ["work_log.review.assigned_group"] },
];

const clientNavigation: NavigationItem[] = [
  { label: "Dashboard", labelKey: "Navigation.dashboard", href: "", icon: LayoutDashboard },
  { label: "Calendar", labelKey: "Navigation.calendar", href: "/task-calendar", icon: CalendarDays },
  { label: "Active services", labelKey: "Navigation.activeServices", href: "/services", icon: Handshake },
  { label: "Deliverables", labelKey: "Navigation.deliverables", href: "/deliverables", icon: FileText },
  { label: "Requests", labelKey: "Navigation.requests", href: "/requests", icon: ClipboardList },
  { label: "Invoices", labelKey: "Navigation.invoices", href: "/invoices", icon: ReceiptText },
  { label: "Feedback", labelKey: "Navigation.feedback", href: "/feedback", icon: Star },
  { label: "Profile", labelKey: "Navigation.profile", href: "/profile", icon: Users },
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

const superAdminNavigation = filterForWorkspace(common, "super-admin").flatMap(
  (item) => item.children ?? [item],
);

const tenantAdminItemsByLabel = new Map(
  filterForWorkspace(common, "admin")
    .flatMap((item) => item.children ?? [item])
    .map((item) => [item.label, item]),
);

const tenantTasksItem = tenantAdminItemsByLabel.get("Tasks");
if (tenantTasksItem) {
  tenantAdminItemsByLabel.set("Task request", {
    ...tenantTasksItem,
    label: "Task request",
    labelKey: "Navigation.taskRequest",
  });
  tenantAdminItemsByLabel.set("Task review", {
    ...tenantTasksItem,
    label: "Task review",
    labelKey: "Navigation.taskReview",
    href: "/task-review",
    icon: ClipboardList,
  });
}

const tenantAdminItem = (label: string) => tenantAdminItemsByLabel.get(label);
const tenantAdminGroup = (
  label: string,
  icon: NavigationItem["icon"],
  childLabels: readonly string[],
): NavigationItem | undefined => {
  const children = childLabels
    .map(tenantAdminItem)
    .filter((item): item is NavigationItem => Boolean(item));
  return children.length ? { label, icon, children } : undefined;
};

const tenantAdminNavigation = [
  tenantAdminItem("Dashboard"),
  tenantAdminGroup("People & Teams", Users, [
    "Departments",
    "Employees",
    "Task review",
    "Managers",
    "Employee Performance",
    "Feedback log",
  ]),
  tenantAdminGroup("Clients", Building2, [
    "Clients",
    "Agreements",
  ]),
  tenantAdminGroup("Operations", ClipboardList, [
    "Services",
    "Task request",
    "Calendar",
  ]),
  tenantAdminGroup(
    "Finance & Documents",
    ReceiptText,
    ["Invoices", "Documents"],
  ),
  tenantAdminItem("Settings"),
].filter((item): item is NavigationItem => Boolean(item));

export const navigationFor = (workspace: Workspace, isManager = false) =>
  workspace === "super-admin"
    ? superAdminNavigation
    : workspace === "admin"
      ? tenantAdminNavigation
    : workspace === "employee"
      ? isManager
        ? [...employeeNavigation, { label: "Manager", labelKey: "Workspace.manager", icon: Users, children: employeeManagerNavigation }]
        : employeeNavigation
      : workspace === "client"
        ? clientNavigation
        : filterForWorkspace(common, workspace);
