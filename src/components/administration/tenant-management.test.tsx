import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  TenantCreateForm,
  TenantDirectory,
} from "@/components/administration/tenant-management";

const replace = vi.fn();
const push = vi.fn();
const mockAdministrationApi = vi.hoisted(() => ({
  getTenant: vi.fn(),
  listAuditRecords: vi.fn(),
  listTenantListFilters: vi.fn(),
  listTenants: vi.fn(),
  updateTenantStatus: vi.fn(),
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
  mockAdministrationApi.listTenantListFilters.mockResolvedValue({
    countries: ["GB", "IN"],
    financialYears: [
      { countryCode: "GB", label: "FY 2026-27" },
      { countryCode: "IN", label: "FY 2026-27" },
    ],
  });
  mockAdministrationApi.updateTenantStatus.mockResolvedValue({
    tenantId: "tenant-1",
    status: "suspended",
    suspensionEndsAt: "2026-08-05T00:00:00.000Z",
    revokedAt: null,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("stores tenant status filters in URL search parameters", async () => {
  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");
  expect(screen.getAllByText("Not logged in").length).toBeGreaterThan(0);
  expect(screen.queryByText("pending activation")).not.toBeInTheDocument();
  expect(screen.getAllByLabelText("Actions for Northstar Labs")[0]).toBeInTheDocument();
  expect(screen.getAllByText("Suspend tenant").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Revoke tenant").length).toBeGreaterThan(0);
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

test("stores country and financial-year filters in URL search parameters", async () => {
  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");

  fireEvent.change(screen.getByLabelText("Filter by country"), {
    target: { value: "IN" },
  });
  expect(replace).toHaveBeenCalledWith("/super-admin/tenants?countryCode=IN", {
    scroll: false,
  });

  fireEvent.change(screen.getByLabelText("Filter by financial year"), {
    target: { value: "FY 2026-27" },
  });
  expect(replace).toHaveBeenCalledWith("/super-admin/tenants?financialYear=FY+2026-27", {
    scroll: false,
  });
});

test("does not offer lifecycle actions for a cancelled tenant", async () => {
  mockAdministrationApi.listTenants.mockResolvedValue({
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

test("requires a selected duration before suspending and shows two revoke warnings", async () => {
  mockAdministrationApi.listTenants.mockResolvedValue({
    items: [{
      id: "tenant-1", name: "Northstar Labs", code: "NS001",
      owner: { name: "Nora Admin", email: "nora@example.com" }, status: "active",
      employeeCount: 0, clientCount: 0, createdAt: "2026-07-31T00:00:00.000Z", usagePercent: 0,
    }], page: 1, pageSize: 5, pageCount: 1, totalItems: 1,
  });

  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");
  fireEvent.click(screen.getAllByText("Suspend tenant")[0]);
  expect(screen.getByLabelText("Suspension period")).toHaveValue("24h");
  fireEvent.change(screen.getByLabelText("Suspension period"), { target: { value: "1w" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Suspend tenant" }).at(-1)!);
  await waitFor(() => expect(mockAdministrationApi.updateTenantStatus).toHaveBeenCalledWith(
    "tenant-1", "suspended", { suspensionDuration: "1w", revokeConfirmation: undefined },
  ));

  fireEvent.click(screen.getAllByText("Revoke tenant")[0]);
  expect(screen.getAllByText("Caution: revoke tenant access").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getAllByText("Revoke tenant permanently").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: "Revoke tenant" }).at(-1)).toBeDisabled();
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
