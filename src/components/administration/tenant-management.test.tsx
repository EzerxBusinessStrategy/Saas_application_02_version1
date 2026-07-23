import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ControlledSupportAccess,
  TenantCreateForm,
  TenantDirectory,
} from "@/components/administration/tenant-management";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-admin/tenants",
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
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("stores tenant status filters in URL search parameters", async () => {
  renderWithQuery(<TenantDirectory />);
  await screen.findAllByText("Northstar Labs");
  fireEvent.change(screen.getByLabelText("Filter by tenant status"), {
    target: { value: "active" },
  });
  expect(replace).toHaveBeenCalledWith("/super-admin/tenants?status=active", {
    scroll: false,
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
