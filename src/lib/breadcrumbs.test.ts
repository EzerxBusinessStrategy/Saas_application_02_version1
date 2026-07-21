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
    { label: "Tenant administration", href: "/admin" },
    { label: "Employees", current: true },
  ]);
  expect(
    breadcrumbsFor({
      pathname: "/employee/invoices",
      workspace: "employee",
      role: "EMPLOYEE",
    }),
  ).toEqual([{ label: "Employee", href: "/employee" }]);
});
