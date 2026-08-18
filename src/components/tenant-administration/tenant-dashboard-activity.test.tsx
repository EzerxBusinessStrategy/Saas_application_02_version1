import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { TenantDashboardActivity } from "@/components/tenant-administration/tenant-dashboard-activity";

test("sends tenant admins to the tenant activity page instead of the platform audit log", () => {
  render(
    <TenantDashboardActivity
      events={[]}
      periodLabel="Apr 1, 2026 – Mar 31, 2027"
      periodFrom="2026-04-01"
      periodTo="2027-03-31"
    />,
  );

  expect(screen.getByRole("link", { name: "View all activity" })).toHaveAttribute(
    "href",
    "/admin/activity?from=2026-04-01&to=2027-03-31",
  );
});
