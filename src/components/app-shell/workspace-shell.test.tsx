/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- Next image is mocked for unit tests. */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { workspaceConfig } from "@/mocks/workspaces";

const pathname = vi.hoisted(() => ({ value: "/admin/employees" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("next/image", () => ({
  default: ({ priority: _priority, ...props }: Record<string, unknown>) => (
    <img {...props} />
  ),
}));

afterEach(cleanup);

test("collapses the sidebar and keeps restricted navigation hidden", () => {
  const employee = workspaceConfig("employee").user;
  pathname.value = "/employee/tasks";
  render(
    <WorkspaceShell workspace="employee" user={employee}>
      <p>Content</p>
    </WorkspaceShell>,
  );
  expect(screen.queryByText("Invoices")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
  expect(screen.getAllByTitle("Dashboard").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(screen.getByText("Dashboard")).toBeInTheDocument();
});

test("opens the mobile navigation drawer and limits the tenant switcher to super admins", () => {
  const admin = workspaceConfig("admin").user;
  pathname.value = "/admin";
  const { rerender } = render(
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
  rerender(
    <WorkspaceShell workspace="super-admin" user={superAdmin}>
      <p>Content</p>
    </WorkspaceShell>,
  );
  expect(
    screen.getByLabelText("Tenant context: Platform context"),
  ).toBeInTheDocument();
});
