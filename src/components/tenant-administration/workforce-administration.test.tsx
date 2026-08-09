import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { EmployeeProfile, TenantSettings } from "@/components/tenant-administration/workforce-administration";
import { FeatureBoundary } from "@/components/shared/feature-boundary";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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
  const { getByLabelText, getByRole, getByText, findByText } = render(<TenantSettings />);
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
  const { container } = render(<TenantSettings />);
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
  const { container, findByText } = render(<TenantSettings />);
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
