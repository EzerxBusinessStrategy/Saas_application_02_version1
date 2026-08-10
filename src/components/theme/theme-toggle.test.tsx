import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  THEME_ANIMATION_COOLDOWN_MS,
  THEME_ANIMATION_STORAGE_KEY,
  THEME_DARK_TRANSITION_DURATION_MS,
  ThemeToggle,
  shouldPlayThemeTransition,
} from "@/components/theme/theme-toggle";

const theme = vi.hoisted(() => ({
  resolvedTheme: "light" as "light" | "dark",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({ useTheme: () => theme }));

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  theme.resolvedTheme = "light";
  theme.setTheme.mockReset();
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("calculates the 45-second special-transition cooldown", () => {
  const now = 1_000_000;
  expect(THEME_ANIMATION_COOLDOWN_MS).toBe(45_000);
  expect(shouldPlayThemeTransition(now, null)).toBe(true);
  expect(shouldPlayThemeTransition(now, "not-a-time")).toBe(true);
  expect(shouldPlayThemeTransition(now, String(now - 1))).toBe(false);
  expect(
    shouldPlayThemeTransition(now, String(now - THEME_ANIMATION_COOLDOWN_MS)),
  ).toBe(true);
});

test("uses a semantic switch without a native browser tooltip", async () => {
  render(<ThemeToggle />);

  const toggle = await screen.findByRole("switch", {
    name: "Switch to dark mode",
  });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(toggle).not.toHaveAttribute("title");
  expect(toggle.querySelector(".bb8-theme-toggle__tooltip")).toBeInTheDocument();
  expect(screen.queryByText(/Theme animation ready/)).not.toBeInTheDocument();
});

test("switches to dark mode with five independently configured shooting stars", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  render(<ThemeToggle />);

  const toggle = await screen.findByRole("switch", {
    name: "Switch to dark mode",
  });
  fireEvent.click(toggle);

  expect(theme.setTheme).toHaveBeenCalledWith("dark");
  expect(window.localStorage.getItem(THEME_ANIMATION_STORAGE_KEY)).toBe(
    "1000000",
  );
  const overlay = document.querySelector(".theme-transition-overlay--dark");
  expect(overlay).toBeInTheDocument();
  expect(overlay).toHaveAttribute("aria-hidden", "true");

  const stars = overlay?.querySelectorAll(".theme-shooting-star");
  expect(stars).toHaveLength(5);
  expect(
    new Set(Array.from(stars ?? []).map((star) => star.getAttribute("style"))),
  ).toHaveLength(5);
});

test("uses the supplied toggle visual in dark mode and suppresses the special effect during reduced motion", async () => {
  theme.resolvedTheme = "dark";
  setReducedMotion(true);
  render(<ThemeToggle />);

  const toggle = await screen.findByRole("switch", {
    name: "Switch to light mode",
  });
  expect(toggle.querySelector(".bb8-theme-toggle__droid")).toBeInTheDocument();
  fireEvent.click(toggle);

  expect(theme.setTheme).toHaveBeenCalledWith("light");
  expect(
    document.querySelector(".theme-transition-overlay"),
  ).not.toBeInTheDocument();
  expect(window.localStorage.getItem(THEME_ANIMATION_STORAGE_KEY)).toBeNull();
});

test("keeps the normal theme change while suppressing a repeated special effect", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  window.localStorage.setItem(THEME_ANIMATION_STORAGE_KEY, "999999");
  render(<ThemeToggle />);

  fireEvent.click(
    await screen.findByRole("switch", { name: "Switch to dark mode" }),
  );

  expect(theme.setTheme).toHaveBeenCalledWith("dark");
  expect(
    document.querySelector(".theme-transition-overlay"),
  ).not.toBeInTheDocument();
});

test("keeps the dark transition mounted until all delayed stars finish, then cleans it up", () => {
  vi.useFakeTimers();
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  render(<ThemeToggle />);

  fireEvent.click(screen.getByRole("switch", { name: "Switch to dark mode" }));
  expect(
    document.querySelector(".theme-transition-overlay"),
  ).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(THEME_DARK_TRANSITION_DURATION_MS - 1));
  expect(
    document.querySelector(".theme-transition-overlay"),
  ).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(1));
  expect(
    document.querySelector(".theme-transition-overlay"),
  ).not.toBeInTheDocument();
});
