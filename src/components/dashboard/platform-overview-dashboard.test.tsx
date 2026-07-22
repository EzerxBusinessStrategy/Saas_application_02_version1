import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PlatformOverviewDashboard } from "@/components/dashboard/platform-overview-dashboard";
import { platformOverview } from "@/mocks/platform-overview";

test("renders all Super Admin dashboard sections", () => {
  const { container } = render(
    <PlatformOverviewDashboard overview={platformOverview} />,
  );
  expect(
    screen.getByRole("heading", { name: "Tenant health" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Global audit activity" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /last 30 days/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByLabelText("Page context: Super Admin"),
  ).toBeInTheDocument();
  expect(container.querySelectorAll(".super-admin-signal")).toHaveLength(3);
  expect(container.querySelectorAll(".super-admin-signal--health")).toHaveLength(
    1,
  );
  expect(
    container.querySelectorAll(".super-admin-signal--activity"),
  ).toHaveLength(1);
  expect(container.querySelectorAll(".super-admin-signal--alert")).toHaveLength(
    1,
  );
  expect(container.querySelectorAll(".super-admin-kpi-arrow")).toHaveLength(0);
  expect(screen.getByText("on track").closest("li")).toHaveClass(
    "items-center",
  );
});
