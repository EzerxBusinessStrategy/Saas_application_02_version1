import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EmployeeDirectory } from "@/components/workforce/employee-directory";
import { listTenantAdminEmployeeDirectory, listTenantAdminWorkGroups } from "@/features/operations/api/operations-api";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/employees",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/operations/api/operations-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/operations/api/operations-api")>()),
  listTenantAdminEmployeeDirectory: vi.fn(),
  listTenantAdminWorkGroups: vi.fn(),
}));

beforeEach(() => {
  replace.mockClear();
  vi.mocked(listTenantAdminEmployeeDirectory).mockResolvedValue({
    employees: [
      {
        id: "employee-1",
        name: "Aarav Mehta",
        employeeCode: "EMP-001",
        email: "aarav@example.test",
        departmentId: "department-1",
        departmentName: "Taxation",
        isManager: false,
        skills: ["GST returns"],
        categories: ["Tax"],
        experienceLevel: "mid",
        managerId: null,
        managerName: null,
        activeTasks: 1,
        workGroups: [],
        employmentStatus: "active",
        weeklyCapacityHours: 40,
      },
    ],
    departments: [{ id: "department-1", name: "Taxation" }],
  });
  vi.mocked(listTenantAdminWorkGroups).mockResolvedValue([
    {
      id: "work-group-1",
      name: "GST filing",
      clientId: null,
      clientName: null,
      managerEmployeeId: "manager-1",
      managerName: "Manager One",
      memberCount: 1,
      members: [],
      status: "active",
    },
  ]);
});
afterEach(cleanup);

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

test("renders an accessible employee table and mobile card fallback", async () => {
  renderWithQuery(<EmployeeDirectory />);
  expect(
    await screen.findByRole("table", { name: "Employees in the active tenant" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("Aarav Mehta").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Filter by department")).toBeInTheDocument();
});

test("stores filter changes in the URL", async () => {
  renderWithQuery(<EmployeeDirectory />);
  await screen.findByLabelText("Filter by department");
  fireEvent.change(screen.getByLabelText("Filter by department"), {
    target: { value: "Taxation" },
  });
  expect(replace).toHaveBeenCalledWith("/admin/employees?department=Taxation", {
    scroll: false,
  });
});

test("replaces the assignment department selector with work group membership", async () => {
  renderWithQuery(<EmployeeDirectory />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));

  expect(await screen.findByRole("group", { name: "Work groups" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("GST filing")).toBeInTheDocument());
  expect(screen.queryByLabelText("Department")).not.toBeInTheDocument();
});
