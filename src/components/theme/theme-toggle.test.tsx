import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const theme = vi.hoisted(() => ({
  resolvedTheme: "light" as "light" | "dark",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({ useTheme: () => theme }));

beforeEach(() => {
  theme.resolvedTheme = "light";
  theme.setTheme.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("shows a compact icon button with a native tooltip in light mode", async () => {
  render(<ThemeToggle />);

  const toggle = await screen.findByRole("button", { name: "Switch to dark mode" });
  expect(toggle).toHaveAttribute("title", "Switch to dark mode");
  expect(toggle).toHaveClass("size-10");
  expect(document.querySelector(".bb8-theme-toggle")).not.toBeInTheDocument();
  expect(document.querySelector(".theme-transition-overlay")).not.toBeInTheDocument();
});

test("switches directly to dark mode on click", async () => {
  render(<ThemeToggle />);

  fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

  expect(theme.setTheme).toHaveBeenCalledWith("dark");
});

test("switches directly to light mode when dark is active", async () => {
  theme.resolvedTheme = "dark";
  render(<ThemeToggle />);

  fireEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));

  expect(theme.setTheme).toHaveBeenCalledWith("light");
});
