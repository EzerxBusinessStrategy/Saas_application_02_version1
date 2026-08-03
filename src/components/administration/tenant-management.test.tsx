import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ControlledSupportAccess,
  TenantCreateForm,
  TenantDirectory,
} from "@/components/administration/tenant-management";

const replace = vi.fn();
const push = vi.fn();
const mockAdministrationApi = vi.hoisted(() => ({
  cancelTenantAdminInvitation: vi.fn(),
  getTenant: vi.fn(),
  listAuditRecords: vi.fn(),
  listTenants: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-admin/tenants",
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/administration/api/administration-api", () => mockAdministrationApi);
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  mockAdministrationApi.listTenants.mockResolvedValue({
    items: [
      {
        id: "tenant-1",
        name: "Northstar Labs",
        code: "NS001",
        owner: { name: "Nora Admin", email: "nora@example.com" },
        status: "pending_activation",
        employeeCount: 0,
        clientCount: 0,
        createdAt: "2026-07-31T00:00:00.000Z",
        usagePercent: 0,
      },
    ],
    page: 1,
    pageSize: 5,
    pageCount: 1,
    totalItems: 1,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("stores tenant status filters in URL search parameters", async () => {
  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");
  expect(screen.getAllByLabelText("Actions for Northstar Labs")[0]).toBeInTheDocument();
  expect(screen.getAllByText("Cancel invitation").length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText("Filter by tenant status"), {
    target: { value: "active" },
  });
  expect(replace).toHaveBeenCalledWith("/super-admin/tenants?status=active", {
    scroll: false,
  });
});

test("filters cancelled tenants through the database query", async () => {
  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");

  fireEvent.change(screen.getByLabelText("Filter by tenant status"), {
    target: { value: "cancelled" },
  });

  expect(replace).toHaveBeenCalledWith("/super-admin/tenants?status=cancelled", {
    scroll: false,
  });
});

test("does not offer lifecycle actions for a cancelled tenant", async () => {
  mockAdministrationApi.listTenants.mockResolvedValueOnce({
    items: [{
      id: "tenant-1",
      name: "Northstar Labs",
      code: "NS001",
      owner: { name: "Invitation cancelled", email: "" },
      status: "cancelled",
      employeeCount: 0,
      clientCount: 0,
      createdAt: "2026-07-31T00:00:00.000Z",
      usagePercent: 0,
    }],
    page: 1,
    pageSize: 5,
    pageCount: 1,
    totalItems: 1,
  });

  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");

  expect(screen.queryByText("Suspend tenant")).not.toBeInTheDocument();
  expect(screen.queryByText("Reactivate tenant")).not.toBeInTheDocument();
});

test("searches tenants only after clicking the input button or pressing Enter", async () => {
  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");

  const search = screen.getByPlaceholderText("Search tenant, code, or owner");
  fireEvent.change(search, {
    target: { value: "north" },
  });

  expect(replace).not.toHaveBeenCalled();
  expect(mockAdministrationApi.listTenants).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Search tenants" }));

  await waitFor(
    () => {
      expect(mockAdministrationApi.listTenants).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: "north" }),
      );
    },
    { timeout: 500 },
  );

  fireEvent.change(search, { target: { value: "labs" } });
  fireEvent.keyDown(search, { key: "Enter" });
  await waitFor(() => {
    expect(mockAdministrationApi.listTenants).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: "labs" }),
    );
  });
});

test("shows tenant creation validation and retains the form", async () => {
  render(<TenantCreateForm />);
  expect(screen.getByLabelText("Tenant provisioning steps")).toHaveTextContent("1. Company");
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare tenant request" }),
  );
  expect(
    await screen.findByText("Enter the organisation name."),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Enter the tenant owner's name."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", { name: /I confirm these details/ }),
  ).toBeInTheDocument();
});

test("makes support mode visible with an expiry and exit action", async () => {
  render(<ControlledSupportAccess />);
  fireEvent.change(screen.getByLabelText("Tenant"), {
    target: { value: "tn-001" },
  });
  fireEvent.change(screen.getByRole("textbox"), {
    target: {
      value: "Investigate an export timeout for the tenant administrator.",
    },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Start visible support session" }),
  );
  expect(
    await screen.findByText("Support mode is visible and time-limited"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Exit support mode" }),
  ).toBeInTheDocument();
});
