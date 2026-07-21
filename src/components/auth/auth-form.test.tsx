import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";

afterEach(cleanup);

test("reports invalid sign-in credentials", async () => {
  render(<AuthForm mode="login" />);
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByText("Enter a valid work email."),
  ).toBeInTheDocument();
});

test("allows password visibility to be toggled", () => {
  render(<AuthForm mode="login" />);
  const password = screen.getByLabelText("Password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
});
