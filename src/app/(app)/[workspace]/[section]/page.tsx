import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { SectionSkeleton } from "@/components/shared/section-skeleton";
import { ManagerDirectory } from "@/components/tenant-administration/workforce-administration";
import { sectionAccess } from "@/lib/route-access";
import { getAuthenticatedWorkspaceUser } from "@/lib/server/authenticated-workspace-user";
import { normalizeAppWorkspace } from "@/lib/workspace-routing";
import type { Workspace } from "@/types/domain";

const dynamicSection = (load: () => Promise<{ default: ComponentType<any> }>) =>
  dynamic(load, { loading: () => <SectionSkeleton /> });

const EmployeeDirectory = dynamicSection(() =>
  import("@/components/workforce/employee-directory").then((module) => ({ default: module.EmployeeDirectory })),
);
const DepartmentDirectory = dynamicSection(() =>
  import("@/components/workforce/department-directory").then((module) => ({ default: module.DepartmentDirectory })),
);
const TenantDirectory = dynamicSection(() =>
  import("@/components/administration/tenant-management").then((module) => ({ default: module.TenantDirectory })),
);
const TenantAnalyticsPage = dynamicSection(() =>
  import("@/components/administration/tenant-analytics").then((module) => ({ default: module.TenantAnalyticsPage })),
);
const TenantPasswordPage = dynamicSection(() =>
  import("@/components/administration/tenant-password").then((module) => ({ default: module.TenantPasswordPage })),
);
const GlobalAuditLog = dynamicSection(() =>
  import("@/components/administration/platform-administration").then((module) => ({ default: module.GlobalAuditLog })),
);
const PlatformConfiguration = dynamicSection(() =>
  import("@/components/administration/platform-administration").then((module) => ({ default: module.PlatformConfiguration })),
);
const PlatformReports = dynamicSection(() =>
  import("@/components/administration/platform-administration").then((module) => ({ default: module.PlatformReports })),
);
const ClientDirectory = dynamicSection(() =>
  import("@/components/tenant-administration/client-management").then((module) => ({ default: module.ClientDirectory })),
);
const TenantServiceDirectory = dynamicSection(() =>
  import("@/components/tenant-administration/service-management").then((module) => ({ default: module.TenantServiceDirectory })),
);
const TenantEmployeePerformancePage = dynamicSection(() =>
  import("@/components/tenant-administration/employee-performance").then((module) => ({ default: module.TenantEmployeePerformancePage })),
);
const TenantSettingsPage = dynamicSection(() =>
  import("@/components/tenant-administration/tenant-settings").then((module) => ({ default: module.TenantSettingsPage })),
);
const ClientPortal = dynamicSection(() =>
  import("@/components/operations/client-portal").then((module) => ({ default: module.ClientPortal })),
);
const EmployeeWorkspace = dynamicSection(() =>
  import("@/components/operations/employee-workspace").then((module) => ({ default: module.EmployeeWorkspace })),
);
const FinanceDocuments = dynamicSection(() =>
  import("@/components/operations/finance-documents").then((module) => ({ default: module.FinanceDocuments })),
);

export default async function Section({
  params,
}: {
  params: Promise<{ workspace: string; section: string }>;
}) {
  const { workspace: rawWorkspace, section } = await params;
  const workspace = normalizeAppWorkspace(rawWorkspace);
  if (!workspace) notFound();
  if (section === "login") notFound();
  const access = sectionAccess[section];
  if (access && !access.workspaces.includes(workspace)) notFound();
  const user = await getAuthenticatedWorkspaceUser(workspace);
  if (section === "employees" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={access.permissions ?? []}>
        <EmployeeDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "departments" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["employee.read"]}>
        <DepartmentDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "employee-performance" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["employee.read"]}>
        <TenantEmployeePerformancePage />
      </FeatureBoundary>
    );
  }
  if (section === "tenants") {
    return (
      <FeatureBoundary role={user.role} permissions={["tenant.read"]}>
        <TenantDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "platform-settings") {
    return (
      <FeatureBoundary role={user.role} permissions={["platform.configuration.update"]}>
        <PlatformConfiguration />
      </FeatureBoundary>
    );
  }
  if (section === "tenant-analytics") {
    return (
      <FeatureBoundary role={user.role} permissions={["report.read"]}>
        <TenantAnalyticsPage />
      </FeatureBoundary>
    );
  }
  if (section === "tenant-password") {
    return (
      <FeatureBoundary role={user.role} permissions={["tenant.update"]}>
        <TenantPasswordPage />
      </FeatureBoundary>
    );
  }
  if (section === "reports" && workspace === "super-admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["report.read"]}>
        <PlatformReports />
      </FeatureBoundary>
    );
  }
  if (section === "audit-log" && workspace === "super-admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["audit_log.read"]}>
        <GlobalAuditLog />
      </FeatureBoundary>
    );
  }
  if (section === "audit-log" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["audit_log.read"]}>
        <GlobalAuditLog tenantName="SaaS App" />
      </FeatureBoundary>
    );
  }
  if (section === "clients" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["client.read"]}>
        <ClientDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "services" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["client.read"]}>
        <TenantServiceDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "service-requests" && workspace === "admin") {
    redirect(`/${workspace}/tasks`);
  }
  if (
    workspace === "employee" &&
    ["clients", "assign-task", "task-reviews"].includes(section)
  ) {
    return (
      <EmployeeWorkspace
        section={section as "clients" | "assign-task" | "task-reviews"}
      />
    );
  }
  if (
    workspace === "employee" &&
    [
      "notifications",
      "profile",
    ].includes(section)
  ) {
    return (
      <FeatureBoundary role={user.role} permissions={access?.permissions ?? []}>
        <EmployeeWorkspace
          section={
            section as
              | "notifications"
              | "profile"
          }
        />
      </FeatureBoundary>
    );
  }
  if (
    workspace === "client" &&
    [
      "services",
      "requests",
      "profile",
      "deliverables",
      "invoices",
    ].includes(section)
  ) {
    return (
      <FeatureBoundary role={user.role} permissions={access?.permissions ?? []}>
        <ClientPortal
          section={section as "services" | "requests" | "profile" | "deliverables" | "invoices"}
        />
      </FeatureBoundary>
    );
  }
  if (["invoices", "documents"].includes(section) || (section === "agreements" && workspace === "admin")) {
    const financePermission =
      section === "documents"
          ? "document.read"
          : "invoice.create";
    if (
      workspace === "admin" ||
      (workspace === "employee" && section === "documents")
    ) {
      return (
        <FeatureBoundary role={user.role} permissions={[financePermission]}>
          <FinanceDocuments
            workspace={workspace}
            section={
              section as "invoices" | "agreements" | "documents"
            }
          />
        </FeatureBoundary>
      );
    }
  }
  if (section === "managers") {
    return (
      <FeatureBoundary role={user.role} permissions={["employee.read"]}>
        <ManagerDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "settings" && workspace === "admin") {
    return <TenantSettingsPage />;
  }
  if (section === "account" && workspace === "super-admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["platform.configuration.update"]}>
        <PlatformConfiguration />
      </FeatureBoundary>
    );
  }
  notFound();
}
