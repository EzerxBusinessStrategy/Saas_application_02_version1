import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EmployeeDirectory } from "@/components/workforce/employee-directory";
import { listTenantAdminEmployeeDirectory } from "@/features/operations/api/operations-api";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/employees",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/operations/api/operations-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/operations/api/operations-api")>()),
  listTenantAdminEmployeeDirectory: vi.fn(),
  listTenantAdminServices: vi.fn(async () => [
    { id: "service-1", name: "GST Compliance", code: "GST", status: "active" as const, rates: [] },
  ]),
}));

vi.mock("@/features/administration/api/service-onboarding-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/administration/api/service-onboarding-api")>()),
  getEmployeeServiceCapabilities: vi.fn(async () => ({
    employeeId: "employee-1",
    capabilities: [{ serviceId: "service-1", serviceName: "GST Compliance", status: "active" as const }],
  })),
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
        isManager: true,
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
  expect(screen.getAllByRole("img", { name: "This employee is a manager" }).length).toBeGreaterThan(0);
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

test("maps employee skills to service specialization", async () => {
  renderWithQuery(<EmployeeDirectory />);
  fireEvent.click(await screen.findByRole("button", { name: "Create employee" }));
  expect(await screen.findByRole("group", { name: "Skills / specialization" })).toBeInTheDocument();
});

test("allows department assignment and services handled", async () => {
  renderWithQuery(<EmployeeDirectory />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));

  expect(await screen.findByRole("group", { name: "Skills / specialization" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Work groups" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Department")).toBeInTheDocument();
});
