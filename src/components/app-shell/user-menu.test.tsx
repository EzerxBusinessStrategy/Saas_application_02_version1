import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { UserMenu } from "@/components/app-shell/user-menu";
import { workspaceConfig } from "@/mocks/workspaces";

test("shows identity, email, profile preferences, and a sign-out action", () => {
  const user = workspaceConfig("super-admin").user;
  render(<UserMenu user={user} workspace="super-admin" open />);
  expect(screen.getByText(user.email)).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Profile and preferences" }),
  ).toHaveAttribute("href", "/super-admin/account");
  expect(screen.queryByRole("menuitem", { name: "Billing" })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Account settings" })).not.toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Sign out" })).not.toHaveAttribute(
    "href",
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("uses the authenticated portal profile when it is available", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      user: { displayName: "Aindrilaa Das", email: "aindrilaa@example.com" },
      roles: ["EMPLOYEE"],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<UserMenu user={workspaceConfig("employee").user} workspace="employee" open />);

  expect(await screen.findAllByText("Aindrilaa Das")).toHaveLength(2);
  expect(screen.getByText("aindrilaa@example.com")).toBeInTheDocument();
  expect(screen.getAllByText("Employee")).toHaveLength(2);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/me?portal=employee",
    expect.objectContaining({ cache: "no-store" }),
  );
});

test.each([
  ["super-admin", "super-admin"],
  ["admin", "tenant"],
  ["manager", "employee"],
  ["employee", "employee"],
  ["client", "client"],
] as const)("reads profile data through the %s portal proxy", async (workspace, portal) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal("fetch", fetchMock);

  render(<UserMenu user={workspaceConfig(workspace).user} workspace={workspace} open />);

  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/me?portal=${portal}`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
