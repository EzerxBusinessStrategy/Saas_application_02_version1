import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PlatformOverviewDashboard } from "@/components/dashboard/platform-overview-dashboard";
import { platformOverview } from "@/mocks/platform-overview";

test("renders all Super Admin dashboard sections", () => {
  render(<PlatformOverviewDashboard overview={platformOverview} />);
  expect(
    screen.getByRole("heading", { name: "Tenant health" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Global audit activity" }),
  ).toBeInTheDocument();
});
