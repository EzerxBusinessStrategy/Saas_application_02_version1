import { describe, expect, it } from "vitest";
import { formatIndiaTimestamp } from "./india-time";

describe("formatIndiaTimestamp", () => {
  it("formats a UTC due date in IST with a timezone label", () => {
    expect(formatIndiaTimestamp("2027-03-11T00:00:00.000Z")).toBe("Thu, 11 Mar, 2027, 05:30 am IST");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatIndiaTimestamp("not-a-date")).toBe("");
  });
});
