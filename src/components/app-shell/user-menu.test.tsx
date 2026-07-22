import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { UserMenu } from "@/components/app-shell/user-menu";
import { workspaceConfig } from "@/mocks/workspaces";

test("shows identity, email, profile preferences, and a sign-out action", () => {
  const user = workspaceConfig("super-admin").user;
  render(<UserMenu user={user} workspace="super-admin" open />);
  expect(screen.getByText(user.email)).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Profile and preferences" }),
  ).toHaveAttribute("href", "/super-admin/account");
  expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveAttribute(
    "href",
    "/login",
  );
});
