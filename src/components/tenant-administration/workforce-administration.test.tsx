import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { EmployeeProfile } from "@/components/tenant-administration/workforce-administration";
import { FeatureBoundary } from "@/components/shared/feature-boundary";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

test("renders employee profile tabs with an accessible skills panel", () => {
  render(<EmployeeProfile employeeId="emp-001" />);
  fireEvent.click(screen.getByRole("tab", { name: "Skills" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("GST returns");
});

test("keeps administration content behind the existing permission boundary", () => {
  render(
    <FeatureBoundary role="EMPLOYEE" permissions={["tenant.read"]}>
      <p>Restricted platform tenant data</p>
    </FeatureBoundary>,
  );
  expect(
    screen.getByText("You don't have access to this area"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Restricted platform tenant data"),
  ).not.toBeInTheDocument();
});
