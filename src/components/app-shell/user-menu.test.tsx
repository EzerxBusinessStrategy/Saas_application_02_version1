import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { UserMenu } from "@/components/app-shell/user-menu";
test("shows a profile skeleton until the authenticated profile is available", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
  render(<UserMenu workspace="super-admin" open />);
  expect(screen.getByRole("status", { name: "Loading account profile" })).toBeInTheDocument();
  expect(screen.queryByText("Jordan Lee")).not.toBeInTheDocument();
});

test("shows identity, email, profile preferences, and a sign-out action", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      user: { displayName: "Platform Administrator", email: "admin@example.com" },
      roles: ["SUPER_ADMIN"],
    }),
  }));
  render(<UserMenu workspace="super-admin" open />);
  expect(await screen.findAllByText("Platform Administrator")).toHaveLength(2);
  expect(screen.getByText("admin@example.com")).toBeInTheDocument();
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

  render(<UserMenu workspace="employee" open />);

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

  render(<UserMenu workspace={workspace} open />);

  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/me?portal=${portal}`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
