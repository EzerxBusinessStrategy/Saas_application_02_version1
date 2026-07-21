import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EmployeeDirectory } from "@/components/workforce/employee-directory";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/employees",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => replace.mockClear());
afterEach(cleanup);

test("renders an accessible employee table and mobile card fallback", () => {
  render(<EmployeeDirectory />);
  expect(
    screen.getByRole("table", { name: "Employees in the active tenant" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("Aarav Mehta").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Filter by department")).toBeInTheDocument();
});

test("stores filter changes in the URL", () => {
  render(<EmployeeDirectory />);
  fireEvent.change(screen.getByLabelText("Filter by department"), {
    target: { value: "Taxation" },
  });
  expect(replace).toHaveBeenCalledWith("/admin/employees?department=Taxation", {
    scroll: false,
  });
});
