import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TenantCreatePageForm } from "@/components/administration/tenant-create-form";

const mockAdministrationApi = vi.hoisted(() => ({
  createTenant: vi.fn(),
  getTenantAdminEmailAvailability: vi.fn(),
  getTenantCreationOptions: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/features/administration/api/administration-api", () => mockAdministrationApi);

const countries = [
  { countryCode: "IN", name: "India", reportingCurrencyCode: "INR", timezone: "Asia/Kolkata" },
  { countryCode: "GB", name: "United Kingdom", reportingCurrencyCode: "GBP", timezone: "Europe/London" },
  { countryCode: "US", name: "United States", reportingCurrencyCode: "USD", timezone: "America/New_York" },
];

function optionsFor(countryCode = "IN") {
  const policyMode = countryCode === "GB" ? "INCORPORATION_DERIVED" : "COMPANY_DEFINED";
  return {
    countries,
    countryCode,
    policyMode,
    suggestedFinancialYear: countryCode === "GB" ? undefined : {
      id: "00000000-0000-0000-0000-000000000001",
      label: countryCode === "IN" ? "FY 2026-27" : `FY ${countryCode} 2026`,
      startsOn: countryCode === "IN" ? "2026-04-01" : "2026-01-01",
      endsOn: countryCode === "IN" ? "2027-03-31" : "2026-12-31",
      source: "COUNTRY_SUGGESTION",
    },
    suggestedYearEnds: countryCode === "US" ? ["12-31"] : undefined,
    confirmationRequired: true,
    customAllowed: true,
    guidance: `Financial year policy for ${countryCode}.`,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockAdministrationApi.getTenantCreationOptions.mockImplementation((countryCode?: string) =>
    Promise.resolve(optionsFor(countryCode ?? "IN")),
  );
  mockAdministrationApi.getTenantAdminEmailAvailability.mockResolvedValue({ available: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("updates incorporation guidance and financial setup when the country changes", async () => {
  renderWithQuery(<TenantCreatePageForm />);

  expect(await screen.findByText(/Optional for India/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Country"), { target: { value: "GB" } });
  expect(await screen.findByText(/Required to calculate the first financial year for United Kingdom/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Company display name"), { target: { value: "Acme UK" } });
  fireEvent.change(screen.getByLabelText("Legal company name"), { target: { value: "Acme UK Ltd" } });
  fireEvent.change(screen.getByLabelText("Tenant code"), { target: { value: "ACMEUK001" } });
  fireEvent.change(screen.getByLabelText("URL slug"), { target: { value: "acme-uk" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save and continue" })[0]);

  await waitFor(() => expect(screen.getByText("Financial setup for United Kingdom")).toBeInTheDocument());
  expect(screen.getByText(/Enter the United Kingdom incorporation date/)).toBeInTheDocument();
  expect(screen.getByLabelText("Financial-year label")).toHaveValue("");

  fireEvent.click(screen.getByRole("button", { name: "Back" }));

  fireEvent.change(screen.getByLabelText("Country"), { target: { value: "US" } });
  expect(await screen.findByText(/Optional for United States/)).toBeInTheDocument();
  expect(screen.queryByText(/Required for UK companies/)).not.toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "Save and continue" })[0]);

  await waitFor(() => expect(screen.getByText("Financial setup for United States")).toBeInTheDocument());
  expect(screen.getByText("Use suggested United States financial year")).toBeInTheDocument();
});

test("shows an inline country loader instead of a blank selector while options load", async () => {
  let resolveOptions!: (value: ReturnType<typeof optionsFor>) => void;
  mockAdministrationApi.getTenantCreationOptions.mockImplementation(
    () => new Promise<ReturnType<typeof optionsFor>>((resolve) => {
      resolveOptions = resolve;
    }),
  );

  renderWithQuery(<TenantCreatePageForm />);

  expect(screen.getByRole("status", { name: "Loading country details" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByRole("option", { name: "Loading countries..." })).toBeInTheDocument();

  resolveOptions(optionsFor());

  await waitFor(() => expect(screen.queryByRole("status", { name: "Loading country details" })).not.toBeInTheDocument());
    expect(screen.getByRole("combobox")).not.toBeDisabled();
});
