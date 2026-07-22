import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PlatformReports } from "@/components/administration/platform-administration";

test("labels tenant values in the global platform report", () => {
  const { container } = render(<PlatformReports />);

  expect(screen.getByText("Northstar Labs")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Page context: Super Admin"),
  ).toBeInTheDocument();
  expect(container.querySelector(".super-admin-surface")).toBeInTheDocument();
  expect(
    screen.getByRole("list", { name: "Tenant active-user counts" }),
  ).toBeInTheDocument();
});
