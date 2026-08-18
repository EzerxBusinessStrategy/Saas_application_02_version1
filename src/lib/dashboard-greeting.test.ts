import { describe, expect, it } from "vitest";
import { formatDashboardMonthLabel, getTimeOfDayGreeting } from "@/lib/dashboard-greeting";

describe("dashboard greeting helpers", () => {
  it("returns morning before noon", () => {
    expect(getTimeOfDayGreeting(new Date("2026-08-18T08:30:00"))).toBe("Good morning");
  });

  it("returns afternoon before evening", () => {
    expect(getTimeOfDayGreeting(new Date("2026-08-18T14:00:00"))).toBe("Good afternoon");
  });

  it("returns evening after 5 pm", () => {
    expect(getTimeOfDayGreeting(new Date("2026-08-18T19:00:00"))).toBe("Good evening");
  });

  it("formats the current month label", () => {
    expect(formatDashboardMonthLabel(new Date("2026-08-18T10:00:00"))).toMatch(/August 2026/);
  });
});
