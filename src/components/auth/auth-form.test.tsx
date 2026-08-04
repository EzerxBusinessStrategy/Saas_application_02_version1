import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(cleanup);
afterAll(() => vi.restoreAllMocks());

test("shows email step first without portal access dropdown", () => {
  render(<AuthForm mode="login" />);
  expect(screen.getByLabelText("Work email")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  // The portal access dropdown must not exist
  expect(screen.queryByLabelText("Portal access")).not.toBeInTheDocument();
});

test("reports invalid email on empty submit", async () => {
  render(<AuthForm mode="login" />);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(
    await screen.findByText("Enter your work email."),
  ).toBeInTheDocument();
});

test("transitions to password step after email identification", async () => {
  // Mock the identify endpoint
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ method: "password", displayName: "Sayantan" }),
  });
  vi.stubGlobal("fetch", mockFetch);

  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "test@company.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => {
    expect(screen.getByText(/Welcome back, Sayantan/)).toBeInTheDocument();
  });

  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");

  vi.unstubAllGlobals();
});

test("shows SSO buttons in password step (disabled)", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ method: "password" }),
  });
  vi.stubGlobal("fetch", mockFetch);

  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "test@company.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  const microsoftBtn = screen.getByRole("button", { name: /Microsoft/ });
  const googleBtn = screen.getByRole("button", { name: /Google/ });
  expect(microsoftBtn).toBeDisabled();
  expect(googleBtn).toBeDisabled();

  vi.unstubAllGlobals();
});

test("allows going back from password step to email step", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ method: "password" }),
  });
  vi.stubGlobal("fetch", mockFetch);

  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "test@company.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Back to email" }));
  expect(screen.getByLabelText("Work email")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

  vi.unstubAllGlobals();
});

test("allows password visibility to be toggled in password step", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ method: "password" }),
  });
  vi.stubGlobal("fetch", mockFetch);

  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "test@company.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => {
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  const password = screen.getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");

  vi.unstubAllGlobals();
});

test("keeps the operational network decorative", () => {
  const { container } = render(<AuthForm mode="login" />);
  expect(container.querySelector("canvas[aria-hidden='true']")).toHaveAttribute(
    "tabindex",
    "-1",
  );
});
