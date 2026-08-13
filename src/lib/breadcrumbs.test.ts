import { expect, test } from "vitest";
import { breadcrumbsFor } from "@/lib/breadcrumbs";

test("generates permission-aware route metadata breadcrumbs", () => {
  expect(
    breadcrumbsFor({
      pathname: "/admin/employees",
      workspace: "admin",
      role: "TENANT_ADMIN",
    }),
  ).toEqual([
    {
      label: "Tenant administration",
      href: "/admin",
      labelKey: "Workspace.tenantAdministration",
    },
    { label: "Employees", current: true, labelKey: "Navigation.employees" },
  ]);
  expect(
    breadcrumbsFor({
      pathname: "/employee/invoices",
      workspace: "employee",
      role: "EMPLOYEE",
    }),
  ).toEqual([
    {
      label: "Employee",
      href: "/employee",
      labelKey: "Workspace.employee",
    },
  ]);
});
