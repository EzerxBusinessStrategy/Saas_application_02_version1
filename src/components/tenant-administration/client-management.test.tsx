import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ClientDirectory,
  ClientDetail,
  WorkGroupDirectory,
} from "@/components/tenant-administration/client-management";
import {
  clientContacts,
  clients,
  engagements,
  workGroups,
} from "@/mocks/administration";

const replace = vi.fn();
const push = vi.fn();
const workGroupEmployee = {
  id: "emp-001",
  name: "Aarav Mehta",
  employeeCode: "EMP-001",
  email: "aarav@example.test",
  departmentId: null,
  departmentName: null,
  isManager: true,
  skills: [],
  categories: [],
  experienceLevel: null,
  managerId: null,
  managerName: null,
  activeTasks: 0,
  workGroups: [],
  employmentStatus: "active",
  weeklyCapacityHours: 40,
};
const initialTenantWorkGroup = {
  id: "wg-01",
  name: "GST Filing",
  clientId: "cl-101",
  clientName: "Northstar Labs",
  managerEmployeeId: workGroupEmployee.id,
  managerName: workGroupEmployee.name,
  memberCount: 1,
  members: [workGroupEmployee],
  status: "active" as const,
};
let createdTenantWorkGroup: typeof initialTenantWorkGroup | undefined;

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/clients",
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  createdTenantWorkGroup = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/tenant-admin/clients/cl-101")) {
        return Response.json({
          ...clients[0],
          contacts: clientContacts,
          engagements,
          workGroups,
          tasks: [],
          invoices: [],
          rateItems: [],
          activity: [],
        });
      }
      if (url.includes("/api/tenant-admin/tasks/employees")) {
        return Response.json({ employees: [workGroupEmployee], departments: [] });
      }
      if (url.includes("/api/tenant-admin/tasks/work-groups")) {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { name: string };
          createdTenantWorkGroup = { ...initialTenantWorkGroup, id: "wg-new", name: body.name };
          return Response.json(createdTenantWorkGroup);
        }
        return Response.json({
          workGroups: createdTenantWorkGroup
            ? [initialTenantWorkGroup, createdTenantWorkGroup]
            : [initialTenantWorkGroup],
        });
      }
      if (url.includes("/api/tenant-admin/clients")) {
        return Response.json({
          items: clients,
          page: 1,
          pageSize: 5,
          pageCount: 1,
          totalItems: clients.length,
          filters: {
            services: [
              { id: "svc-tax", name: "Tax compliance" },
              { id: "svc-accounting", name: "Accounting" },
            ],
            managers: [{ id: "mgr-avery", name: "Avery Patel" }],
          },
        });
      }
      return Response.json({}, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

test("stores client revenue filtering in the URL", async () => {
  renderWithQuery(<ClientDirectory />);
  await screen.findAllByText("Northstar Labs");
  fireEvent.change(screen.getByLabelText("Filter by revenue"), {
    target: { value: "20000" },
  });
  expect(replace).toHaveBeenCalledWith("/admin/clients?revenueMin=20000", {
    scroll: false,
  });
});

test("supports client detail tab navigation and contact validation", async () => {
  renderWithQuery(<ClientDetail clientId="cl-101" />);
  await screen.findAllByText("Northstar Labs");
  fireEvent.click(screen.getByRole("tab", { name: "Contacts" }));
  await screen.findByText("Client contacts");
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  fireEvent.click(screen.getByRole("button", { name: "Save contact" }));
  expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
});

test("validates and retains a mock work-group creation flow", async () => {
  renderWithQuery(<WorkGroupDirectory />);
  await screen.findAllByText("GST Filing");
  fireEvent.click(screen.getByRole("button", { name: "Create work group" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Work-group name"), {
    target: { value: "Audit delivery pod" },
  });
  fireEvent.change(within(dialog).getByLabelText("Client"), {
    target: { value: "cl-101" },
  });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Aarav Mehta" }));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Create work group" }),
  );
  expect(
    (await screen.findAllByText("Audit delivery pod")).length,
  ).toBeGreaterThan(0);
});
