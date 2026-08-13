import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LiveWorldClock } from "@/components/app-shell/live-world-clock";
import { timezones } from "@/i18n/config";

const preferencesApi = vi.hoisted(() => ({ updateUserPreferences: vi.fn() }));
vi.mock("@/features/identity/api/user-preferences-api", () => preferencesApi);
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, disabled, onSelect }: { children: React.ReactNode; disabled?: boolean; onSelect?: () => void }) => <button type="button" disabled={disabled} onClick={onSelect}>{children}</button>,
  DropdownMenuTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

test("updates the clock immediately and persists only the final selection", async () => {
  vi.useFakeTimers();
  preferencesApi.updateUserPreferences.mockResolvedValue({});
  render(<LiveWorldClock preferences={{ locale: "en", timezone: timezones[0].timezone }} />);

  fireEvent.click(screen.getByRole("button", { name: new RegExp(timezones[1].country) }));
  expect(screen.getByRole("button", { name: "Select clock country" })).toHaveTextContent(timezones[1].country);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(timezones[2].country) }));
  expect(screen.getByRole("button", { name: "Select clock country" })).toHaveTextContent(timezones[2].country);
  expect(preferencesApi.updateUserPreferences).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(preferencesApi.updateUserPreferences).toHaveBeenCalledTimes(1);
  expect(preferencesApi.updateUserPreferences).toHaveBeenCalledWith({ locale: "en", timezone: timezones[2].timezone });
});
