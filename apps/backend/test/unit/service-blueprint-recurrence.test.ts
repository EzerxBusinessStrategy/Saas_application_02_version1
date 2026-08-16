import { describe, expect, it } from "vitest";
import { expandRecurrenceOccurrences, yearlyOccurrenceCount } from "../../src/platform/service-blueprint-recurrence";

describe("service blueprint recurrence", () => {
  it("counts yearly occurrences by frequency", () => {
    expect(yearlyOccurrenceCount("monthly")).toBe(12);
    expect(yearlyOccurrenceCount("quarterly")).toBe(4);
    expect(yearlyOccurrenceCount("annually")).toBe(1);
    expect(yearlyOccurrenceCount("one_time")).toBe(1);
  });

  it("expands monthly due dates and skips dates before activation", () => {
    const occurrences = expandRecurrenceOccurrences({
      frequency: "monthly",
      dueRule: { type: "fixed_day_of_month", day: 11 },
      horizonStart: "2026-04-01",
      horizonEnd: "2027-03-31",
      skipBefore: "2026-08-16",
    });
    expect(occurrences[0]?.dueOn).toBe("2026-09-11");
    expect(occurrences.at(-1)?.dueOn).toBe("2027-03-11");
    expect(occurrences.every((item) => item.dueOn >= "2026-08-16")).toBe(true);
  });

  it("does not emit due dates before skipBefore", () => {
    const occurrences = expandRecurrenceOccurrences({
      frequency: "monthly",
      dueRule: { type: "fixed_day_of_month", day: 20 },
      horizonStart: "2026-04-01",
      horizonEnd: "2026-09-30",
      skipBefore: "2026-08-16",
    });
    expect(occurrences.map((item) => item.dueOn)).toEqual(["2026-08-20", "2026-09-20"]);
  });

  it("expands quarterly due dates to quarter-end months", () => {
    const occurrences = expandRecurrenceOccurrences({
      frequency: "quarterly",
      dueRule: { type: "quarterly_due_date", day: 15 },
      horizonStart: "2026-04-01",
      horizonEnd: "2027-03-31",
      skipBefore: "2026-04-01",
    });
    expect(occurrences.map((item) => item.dueOn)).toEqual([
      "2026-06-15",
      "2026-09-15",
      "2026-12-15",
      "2027-03-15",
    ]);
  });

  it("expands an annual due date inside the financial year", () => {
    const occurrences = expandRecurrenceOccurrences({
      frequency: "annually",
      dueRule: { type: "fixed_month_day", month: 3, day: 31 },
      horizonStart: "2026-04-01",
      horizonEnd: "2027-03-31",
      skipBefore: "2026-04-01",
    });
    expect(occurrences.map((item) => item.dueOn)).toEqual(["2027-03-31"]);
  });
});
