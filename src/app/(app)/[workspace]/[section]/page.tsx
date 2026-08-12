import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { SectionSkeleton } from "@/components/shared/section-skeleton";
import { ManagerDirectory } from "@/components/tenant-administration/workforce-administration";
import { sectionAccess } from "@/lib/route-access";
import { workspaceConfig } from "@/mocks/workspaces";
import type { Workspace } from "@/types/domain";

const dynamicSection = (load: () => Promise<{ default: ComponentType<any> }>) =>
  dynamic(load, { loading: () => <SectionSkeleton /> });

const EmployeeDirectory = dynamicSection(() =>
  import("@/components/workforce/employee-directory").then((module) => ({ default: module.EmployeeDirectory })),
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
const WorkGroupDirectory = dynamicSection(() =>
  import("@/components/tenant-administration/client-management").then((module) => ({ default: module.WorkGroupDirectory })),
);
const TenantServiceDirectory = dynamicSection(() =>
  import("@/components/tenant-administration/service-management").then((module) => ({ default: module.TenantServiceDirectory })),
);
const TenantSettings = dynamicSection(() =>
  import("@/components/tenant-administration/workforce-administration").then((module) => ({ default: module.TenantSettings })),
);
const TenantEmployeePerformancePage = dynamicSection(() =>
  import("@/components/tenant-administration/employee-performance").then((module) => ({ default: module.TenantEmployeePerformancePage })),
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
const TenantGamificationSettings = dynamicSection(() =>
  import("@/components/operations/gamification-workflows").then((module) => ({ default: module.TenantGamificationSettings })),
);
const AccountPreferences = dynamicSection(() =>
  import("@/components/app-shell/account-preferences").then((module) => ({ default: module.AccountPreferences })),
);

export default async function Section({
  params,
}: {
  params: Promise<{ workspace: Workspace; section: string }>;
}) {
  const { workspace, section } = await params;
  const access = sectionAccess[section];
  if (access && !access.workspaces.includes(workspace)) notFound();
  if (section === "employees" && workspace === "admin") {
    const user = workspaceConfig(workspace).user;
    return (
      <FeatureBoundary role={user.role} permissions={access.permissions ?? []}>
        <EmployeeDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "employee-performance" && workspace === "admin") {
    const user = workspaceConfig(workspace).user;
    return (
      <FeatureBoundary role={user.role} permissions={["employee.read"]}>
        <TenantEmployeePerformancePage />
      </FeatureBoundary>
    );
  }
  const user = workspaceConfig(workspace).user;
  if (section === "account" && workspace === "super-admin") {
    return <AccountPreferences user={user} />;
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
      "work-logs",
      "timesheet",
      "calendar",
      "notifications",
      "profile",
      "achievements",
      "recognition",
      "preferences",
    ].includes(section)
  ) {
    return (
      <FeatureBoundary role={user.role} permissions={access?.permissions ?? []}>
        <EmployeeWorkspace
          section={
            section as
              | "work-logs"
              | "timesheet"
              | "calendar"
              | "notifications"
              | "profile"
              | "achievements"
              | "recognition"
              | "preferences"
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
    ].includes(section)
  ) {
    return (
      <FeatureBoundary role={user.role} permissions={access?.permissions ?? []}>
        <ClientPortal
          section={section as "services" | "requests" | "profile" | "deliverables"}
        />
      </FeatureBoundary>
    );
  }
  if (["invoices", "payments", "agreements", "documents"].includes(section)) {
    const financePermission =
      workspace === "client"
        ? "client.read.assigned"
        : section === "documents"
          ? "document.read"
          : "invoice.create";
    if (
      workspace === "admin" ||
      workspace === "client" ||
      (workspace === "employee" && section === "documents")
    ) {
      return (
        <FeatureBoundary role={user.role} permissions={[financePermission]}>
          <FinanceDocuments
            workspace={workspace}
            section={
              section as "invoices" | "payments" | "agreements" | "documents"
            }
          />
        </FeatureBoundary>
      );
    }
  }
  if (section === "work-groups" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["work_group.manage"]}>
        <WorkGroupDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "gamification" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["client.update"]}>
        <TenantGamificationSettings />
      </FeatureBoundary>
    );
  }
  if (section === "managers") {
    return (
      <FeatureBoundary role={user.role} permissions={["employee.read"]}>
        <ManagerDirectory />
      </FeatureBoundary>
    );
  }
  if (section === "settings" || section === "branding") {
    return (
      <FeatureBoundary role={user.role} permissions={["client.update"]}>
        <TenantSettings />
      </FeatureBoundary>
    );
  }
  notFound();
}
