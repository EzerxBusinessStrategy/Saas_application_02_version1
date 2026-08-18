import { describe, expect, it } from "vitest";
import {
  computeDatePickerPosition,
  formatDisplayDate,
  isDateOutOfRange,
  parseIsoDate,
  toIsoDate,
} from "@/components/shared/date-picker";

describe("date picker values", () => {
  it("round-trips local ISO dates without UTC shift", () => {
    const date = new Date(2026, 3, 1);
    expect(toIsoDate(date)).toBe("2026-04-01");
    expect(parseIsoDate("2026-04-01")).toEqual(date);
    expect(formatDisplayDate("2026-04-01")).toBe("04/01/2026");
  });

  it("rejects invalid calendar dates and empty labels", () => {
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("No due date")).toBeNull();
    expect(parseIsoDate("2026-04-01T12:00:00.000Z")?.getDate()).toBe(1);
  });

  it("applies min and max bounds", () => {
    expect(isDateOutOfRange(new Date(2026, 3, 1), "2026-04-02")).toBe(true);
    expect(isDateOutOfRange(new Date(2026, 3, 3), undefined, "2026-04-02")).toBe(true);
    expect(isDateOutOfRange(new Date(2026, 3, 2), "2026-04-01", "2026-04-03")).toBe(false);
  });

  it("opens the calendar above the field when there is not enough space below", () => {
    const position = computeDatePickerPosition({
      anchor: { top: 620, bottom: 660, left: 40 },
      popoverHeight: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    expect(position.top).toBeLessThan(620);
    expect(position.top + 360).toBeLessThanOrEqual(620);
  });

  it("keeps the calendar inside the viewport when opening below", () => {
    const position = computeDatePickerPosition({
      anchor: { top: 80, bottom: 120, left: 40 },
      popoverHeight: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    expect(position.top).toBe(128);
    expect(position.left).toBe(40);
  });
});
