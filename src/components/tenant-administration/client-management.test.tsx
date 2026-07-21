import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ClientDirectory,
  ClientDetail,
  WorkGroupDirectory,
} from "@/components/tenant-administration/client-management";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/clients",
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

test("stores client delivery-health filtering in the URL", async () => {
  renderWithQuery(<ClientDirectory />);
  await screen.findAllByText("Northstar Labs");
  fireEvent.change(screen.getByLabelText("Filter delivery health"), {
    target: { value: "watch" },
  });
  expect(replace).toHaveBeenCalledWith("/admin/clients?health=watch", {
    scroll: false,
  });
});

test("supports client detail tab navigation and contact validation", async () => {
  renderWithQuery(<ClientDetail clientId="cl-101" />);
  await screen.findAllByText("Northstar Labs");
  fireEvent.click(screen.getByRole("tab", { name: "Contacts" }));
  await screen.findByText("Client contacts");
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  fireEvent.click(screen.getByRole("button", { name: "Validate contact" }));
  expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
});

test("validates and retains a mock work-group creation flow", async () => {
  renderWithQuery(<WorkGroupDirectory />);
  await screen.findAllByText("GST Filing");
  fireEvent.click(screen.getByRole("button", { name: "Create work group" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Work-group name"), {
    target: { value: "Audit delivery pod" },
  });
  fireEvent.change(within(dialog).getByLabelText("Service engagement"), {
    target: { value: "Compliance review" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Create work group" }),
  );
  expect(
    (await screen.findAllByText("Audit delivery pod")).length,
  ).toBeGreaterThan(0);
});
