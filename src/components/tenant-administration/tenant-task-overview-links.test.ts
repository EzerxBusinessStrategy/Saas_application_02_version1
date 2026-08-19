import { expect, test } from "vitest";
import { tenantTaskOverviewHrefs } from "@/components/tenant-administration/tenant-task-overview-links";

test("gives each task overview card a distinct allocated-work filter", () => {
  const hrefs = tenantTaskOverviewHrefs({ from: "2026-04-01", to: "2027-03-31" });

  expect(hrefs.open).toBe(
    "/admin/allocated-work?status=open&from=2026-04-01&to=2027-03-31&range=kpi",
  );
  expect(hrefs.completed).toBe(
    "/admin/allocated-work?status=completed&from=2026-04-01&to=2027-03-31&range=kpi",
  );
  expect(hrefs.overdue).toBe("/admin/allocated-work?status=overdue");
  expect(hrefs.open).not.toBe(hrefs.completed);
  expect(hrefs.completed).not.toBe(hrefs.overdue);
});
