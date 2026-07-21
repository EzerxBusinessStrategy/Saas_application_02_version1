import { flattenNavigation, navigationFor } from "../src/lib/nav";
import { hasAnyPermission } from "../src/lib/permissions";
const employeeItems = flattenNavigation(navigationFor("employee")).filter(
  (item) => hasAnyPermission("EMPLOYEE", item.permissions),
);
if (employeeItems.some((item) => item.label === "Invoices"))
  throw new Error("Employee navigation exposes invoices.");
console.log("Verified role-filtered navigation.");
