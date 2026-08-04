/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- Next image is mocked for unit tests. */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { tenantBrandingStorageKey } from "@/lib/tenant-branding-session";
import { workspaceConfig } from "@/mocks/workspaces";

const pathname = vi.hoisted(() => ({ value: "/admin/employees" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/image", () => ({
  default: ({ priority: _priority, ...props }: Record<string, unknown>) => (
    <img {...props} />
  ),
}));
vi.mock("@/components/app-shell/notification-menu", () => ({
  NotificationMenu: () => null,
}));

const mockPlatformConfigurationApi = vi.hoisted(() => ({
  getPlatformConfiguration: vi.fn(),
}));

vi.mock("@/features/platform/api/super-admin-platform-configuration-api", () => mockPlatformConfigurationApi);

function renderShell(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return {
    ...result,
    rerender: (next: ReactElement) =>
      result.rerender(<QueryClientProvider client={client}>{next}</QueryClientProvider>),
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.style.removeProperty("--primary");
  document.documentElement.style.removeProperty("--ring");
});

test("uses the active tenant's branding in manager and employee workspaces", () => {
  window.localStorage.setItem(
    tenantBrandingStorageKey("acme"),
    JSON.stringify({
      companyName: "Northstar Advisory",
      primaryColour: "#3C50E0",
      sidebarColour: "#1C2434",
      surfaceColour: "#FFFFFF",
      defaultTheme: "system",
      density: "comfortable",
      headingFont: "System",
      allowUserThemeOverride: true,
      portalSubtitle: "",
    }),
  );
  pathname.value = "/manager";
  const { rerender } = renderShell(
    <WorkspaceShell workspace="manager" user={workspaceConfig("manager").user}>
      <p>Content</p>
    </WorkspaceShell>,
  );

  expect(screen.getByText("Northstar Advisory")).toBeInTheDocument();
  pathname.value = "/employee";
  rerender(
    <WorkspaceShell workspace="employee" user={workspaceConfig("employee").user}>
      <p>Content</p>
    </WorkspaceShell>,
  );
  expect(screen.getByText("Northstar Advisory")).toBeInTheDocument();
});

test("collapses inside the sidebar and keeps active, labelled navigation accessible", () => {
  const employee = workspaceConfig("employee").user;
  pathname.value = "/employee/tasks";
  renderShell(
    <WorkspaceShell workspace="employee" user={employee}>
      <p>Content</p>
    </WorkspaceShell>,
  );
  expect(screen.queryByText("Invoices")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "My tasks" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const sidebar = screen.getByRole("complementary");
  const collapseButton = within(sidebar).getByRole("button", {
    name: "Collapse navigation",
  });
  expect(
    within(screen.getByRole("banner")).queryByRole("button", {
      name: "Collapse navigation",
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(collapseButton);
  const dashboard = screen.getByLabelText("Dashboard");
  const dashboardLabel = dashboard.querySelector("span[aria-hidden]");
  expect(dashboardLabel).toHaveAttribute("aria-hidden", "true");
  expect(
    screen.getByRole("tooltip", { name: "Dashboard" }),
  ).toBeInTheDocument();
  expect(dashboard).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(
    screen
      .getByRole("link", { name: "Dashboard" })
      .querySelector("span[aria-hidden]"),
  ).toHaveAttribute("aria-hidden", "false");
});

test("opens a permission-filtered nested flyout while collapsed", () => {
  const admin = workspaceConfig("admin").user;
  pathname.value = "/admin/employees";
  renderShell(
    <WorkspaceShell workspace="admin" user={admin}>
      <p>Content</p>
    </WorkspaceShell>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
  const operations = screen.getByRole("button", {
    name: "Operations navigation",
  });
  expect(operations).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(operations);
  expect(operations).toHaveAttribute("aria-expanded", "true");
  const flyout = screen.getByRole("group", { name: "Operations navigation" });
  expect(
    within(flyout).getByRole("link", { name: "Employees" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    screen.queryByRole("button", { name: "Platform navigation" }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(operations, { key: "Escape" });
  expect(
    screen.queryByRole("group", { name: "Operations navigation" }),
  ).not.toBeInTheDocument();
});

test("opens the mobile navigation drawer and limits the tenant switcher to super admins", () => {
  const admin = workspaceConfig("admin").user;
  pathname.value = "/admin";
  const { rerender } = renderShell(
    <WorkspaceShell workspace="admin" user={admin}>
      <p>Content</p>
    </WorkspaceShell>,
  );
  expect(screen.queryByLabelText(/Tenant context:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(
    screen.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeInTheDocument();
  const superAdmin = workspaceConfig("super-admin").user;
  pathname.value = "/super-admin";
  mockPlatformConfigurationApi.getPlatformConfiguration.mockResolvedValueOnce({
    platformName: "SaaS App",
    defaultBrand: "#3C50E0",
    senderName: "SaaS App",
  });
  rerender(
    <WorkspaceShell workspace="super-admin" user={superAdmin}>
      <p>Content</p>
    </WorkspaceShell>,
  );
  expect(
    screen.getByLabelText("Tenant context: Platform context"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Refresh dashboard data" }),
  ).toBeInTheDocument();
});

test("uses database platform configuration in the super admin shell", async () => {
  mockPlatformConfigurationApi.getPlatformConfiguration.mockResolvedValueOnce({
    platformName: "Operations Hub",
    defaultBrand: "#9AA4C6",
    senderName: "Operations Hub",
  });
  const superAdmin = workspaceConfig("super-admin").user;
  pathname.value = "/super-admin/configuration";
  renderShell(
    <WorkspaceShell workspace="super-admin" user={superAdmin}>
      <p>Content</p>
    </WorkspaceShell>,
  );

  expect(await screen.findByText("Operations Hub")).toBeInTheDocument();
  expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
    "#9AA4C6",
  );
});

test("shows Super Admin navigation as direct links without dropdown groups", () => {
  mockPlatformConfigurationApi.getPlatformConfiguration.mockResolvedValueOnce({
    platformName: "SaaS App",
    defaultBrand: "#3C50E0",
    senderName: "SaaS App",
  });
  const superAdmin = workspaceConfig("super-admin").user;
  pathname.value = "/super-admin";
  renderShell(
    <WorkspaceShell workspace="super-admin" user={superAdmin}>
      <p>Content</p>
    </WorkspaceShell>,
  );

  expect(screen.getByRole("link", { name: "Reports" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Audit log" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Tenant list" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Support access" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Operations" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Platform" })).not.toBeInTheDocument();
});
