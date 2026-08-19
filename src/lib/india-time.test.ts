import { describe, expect, it } from "vitest";
import { formatIndiaCompactDateTime, formatIndiaTimestamp } from "./india-time";

describe("formatIndiaTimestamp", () => {
  it("formats a UTC due date in IST with a timezone label", () => {
    expect(formatIndiaTimestamp("2027-03-11T00:00:00.000Z")).toBe("Thu, 11 Mar, 2027, 05:30 am IST");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatIndiaTimestamp("not-a-date")).toBe("");
  });

  it("formats a compact single-line IST date and time", () => {
    expect(formatIndiaCompactDateTime("2026-08-19T00:00:00.000Z")).toBe("19 Aug 2026, 05:30");
  });
});
