import { notFound } from "next/navigation";
import { EmployeeDirectory } from "@/components/workforce/employee-directory";
import { TenantDirectory } from "@/components/administration/tenant-management";
import { TenantAnalyticsPage } from "@/components/administration/tenant-analytics";
import { TenantPasswordPage } from "@/components/administration/tenant-password";
import {
  GlobalAuditLog,
  PlatformConfiguration,
  PlatformReports,
} from "@/components/administration/platform-administration";
import {
  ClientDirectory,
  WorkGroupDirectory,
} from "@/components/tenant-administration/client-management";
import {
  ManagerDirectory,
  OrganisationManagement,
  TenantSettings,
} from "@/components/tenant-administration/workforce-administration";
import { ClientPortal } from "@/components/operations/client-portal";
import { EmployeeWorkspace } from "@/components/operations/employee-workspace";
import { FinanceDocuments } from "@/components/operations/finance-documents";
import { ManagerWorkspace } from "@/components/operations/manager-workspace";
import { ReportsWorkspace } from "@/components/operations/reports-workspace";
import { SupportTicketWorkspace } from "@/components/operations/support-ticket-workspace";
import { TenantGamificationSettings } from "@/components/operations/gamification-workflows";
import { AccountPreferences } from "@/components/app-shell/account-preferences";
import { FeatureBoundary } from "@/components/shared/feature-boundary";
import { sectionAccess } from "@/lib/route-access";
import { workspaceConfig } from "@/mocks/workspaces";
import type { Workspace } from "@/types/domain";

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
  if (section === "reports" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["report.read"]}>
        <ReportsWorkspace />
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
  if (section === "tickets" && workspace === "admin") {
    return (
      <FeatureBoundary role={user.role} permissions={["client.update"]}>
        <SupportTicketWorkspace workspace="admin" />
      </FeatureBoundary>
    );
  }
  if (
    workspace === "manager" &&
    [
      "clients",
      "work-groups",
      "employees",
      "reviews",
      "approvals",
      "workload",
      "manager-reports",
      "notifications",
      "profile",
      "recognition",
      "tickets",
    ].includes(section)
  ) {
    const managerSection =
      section === "manager-reports"
        ? "reports"
        : section === "work-groups"
          ? "work-groups"
          : section;
    return (
      <FeatureBoundary role={user.role} permissions={access?.permissions ?? []}>
        <ManagerWorkspace
          section={
            managerSection as Parameters<typeof ManagerWorkspace>[0]["section"]
          }
        />
      </FeatureBoundary>
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
            section as Parameters<typeof EmployeeWorkspace>[0]["section"]
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
      "support",
      "notifications",
      "profile",
      "onboarding",
      "deliverables",
    ].includes(section)
  ) {
    return (
      <FeatureBoundary role={user.role} permissions={access?.permissions ?? []}>
        <ClientPortal
          section={section as Parameters<typeof ClientPortal>[0]["section"]}
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
      (workspace === "manager" && ["documents", "invoices"].includes(section)) ||
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
  if (section === "organisation") {
    return (
      <FeatureBoundary role={user.role} permissions={["employee.read"]}>
        <OrganisationManagement />
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
