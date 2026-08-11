import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { EmployeeProfile, TenantSettings } from "@/components/tenant-administration/workforce-administration";
import { FeatureBoundary } from "@/components/shared/feature-boundary";

const routerRefresh = vi.hoisted(() => vi.fn());
const getTenantProfile = vi.hoisted(() => vi.fn());
const updateTenantProfile = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: routerRefresh }),
}));

vi.mock("@/features/operations/api/operations-api", async () => {
  const actual = await vi.importActual<typeof import("@/features/operations/api/operations-api")>(
    "@/features/operations/api/operations-api",
  );
  return { ...actual, getTenantProfile, updateTenantProfile };
});

beforeEach(() => {
  routerRefresh.mockReset();
  getTenantProfile.mockResolvedValue({
    id: "tenant-1",
    name: "Northstar Consulting",
    currencyCode: "INR",
    timezone: "Asia/Kolkata",
  });
  updateTenantProfile.mockResolvedValue({
    id: "tenant-1",
    name: "Northstar Advisory",
    currencyCode: "INR",
    timezone: "Asia/Kolkata",
  });
});

function renderWithQueryClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

test("renders employee profile tabs with an accessible skills panel", () => {
  renderWithQueryClient(<EmployeeProfile employeeId="emp-001" />);
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

test("validates branding colours and keeps the preview isolated", async () => {
  const { getByLabelText, getByRole, getByText, findByText } = renderWithQueryClient(<TenantSettings />);
  expect(getByText("Live preview")).toBeInTheDocument();
  expect(getByLabelText("Company name")).toBeInTheDocument();
  expect(getByLabelText(/Portal subtitle/i)).toBeInTheDocument();
  expect(getByText("Choose preview image")).toBeInTheDocument();
  fireEvent.change(getByLabelText("Primary colour hexadecimal value"), {
    target: { value: "blue" },
  });
  fireEvent.click(getByRole("button", { name: "Publish changes" }));
  expect(await findByText("Use a six-digit hex colour.")).toBeInTheDocument();
  expect(getByText("active users are not affected", { exact: false })).toBeInTheDocument();
});

test("resets only the three branding colours to their defaults", () => {
  const { container } = renderWithQueryClient(<TenantSettings />);
  const primary = container.querySelector<HTMLInputElement>(
    '[name="primaryColour"]',
  )!;
  const sidebar = container.querySelector<HTMLInputElement>(
    '[name="sidebarColour"]',
  )!;

  fireEvent.change(primary, { target: { value: "#000000" } });
  fireEvent.change(sidebar, { target: { value: "#FFFFFF" } });
  fireEvent.click(
    [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Reset colours",
    )!,
  );

  expect(primary).toHaveValue("#3C50E0");
  expect(sidebar).toHaveValue("#1C2434");
  expect(
    container.querySelector('[name="surfaceColour"]'),
  ).toHaveValue("#FFFFFF");
});

test("publishes validated branding values to the current browser session", async () => {
  const { container, findByText } = renderWithQueryClient(<TenantSettings />);
  fireEvent.change(container.querySelector('[name="companyName"]')!, {
    target: { value: "Northstar Advisory" },
  });
  fireEvent.click(
    [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Publish changes",
    )!,
  );
  expect(await findByText(/Branding is applied to Acme tenant workspaces/)).toBeInTheDocument();
  expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#3C50E0");
  expect(window.localStorage.getItem("ezerx-tenant-branding-draft:acme")).toContain("Northstar Advisory");
});

test("refreshes the Tenant Admin profile label after saving a tenant profile name", async () => {
  const view = renderWithQueryClient(<TenantSettings />);
  const page = within(view.container);
  fireEvent.click(page.getByRole("tab", { name: "Profile" }));

  const profileName = await page.findByDisplayValue("Northstar Consulting");
  fireEvent.change(profileName, { target: { value: "Northstar Advisory" } });
  fireEvent.click(page.getByRole("button", { name: "Save profile" }));

  await waitFor(() =>
    expect(updateTenantProfile).toHaveBeenCalledWith("Northstar Advisory"),
  );
  expect(routerRefresh).toHaveBeenCalledTimes(1);
  expect(await page.findByText("Tenant profile saved.")).toBeInTheDocument();
});
