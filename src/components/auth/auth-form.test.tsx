import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(cleanup);
afterAll(() => vi.restoreAllMocks());

test("reports invalid sign-in credentials", async () => {
  render(<AuthForm mode="login" />);
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByText("Enter your sign-in identifier."),
  ).toBeInTheDocument();
});

test("uses a client user ID field when Client User is selected", () => {
  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText("Portal access"), {
    target: { value: "CLIENT_USER" },
  });
  expect(screen.getByLabelText("Client user ID")).toHaveAttribute(
    "type",
    "text",
  );
});

test("keeps recovery and session controls inside the login form", () => {
  render(<AuthForm mode="login" />);

  expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeInTheDocument();
});

test("keeps the operational network decorative", () => {
  const { container } = render(<AuthForm mode="login" />);
  expect(container.querySelector("canvas[aria-hidden='true']")).toHaveAttribute(
    "tabindex",
    "-1",
  );
});

test("allows password visibility to be toggled", () => {
  render(<AuthForm mode="login" />);
  const password = screen.getByLabelText("Password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
});
