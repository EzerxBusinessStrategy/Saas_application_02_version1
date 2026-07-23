import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import {
  PlatformConfiguration,
  PlatformReports,
} from "@/components/administration/platform-administration";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.style.removeProperty("--primary");
  document.documentElement.style.removeProperty("--ring");
});

test("labels tenant values in the global platform report", () => {
  const { container } = render(<PlatformReports />);

  expect(screen.getByText("Northstar Labs")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Page context: Super Admin"),
  ).toBeInTheDocument();
  expect(container.querySelector(".super-admin-surface")).toBeInTheDocument();
  expect(
    screen.getByRole("list", { name: "Tenant active-user counts" }),
  ).toBeInTheDocument();
});

test("publishes platform configuration to the current browser session", async () => {
  render(<PlatformConfiguration />);

  fireEvent.change(screen.getByLabelText("Platform name"), {
    target: { value: "SaaS Operations" },
  });
  fireEvent.change(
    screen.getByLabelText("Default brand colour hexadecimal value"),
    {
      target: { value: "#9AA4C6" },
    },
  );
  expect(screen.getByText("RGB 154, 164, 198")).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Publish platform configuration" }),
  );

  expect(
    await screen.findByText(/Platform name and brand colour are applied/),
  ).toBeInTheDocument();
  expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
    "#9AA4C6",
  );
  expect(
    window.localStorage.getItem("ezerx-platform-configuration-draft"),
  ).toContain("SaaS Operations");
});
