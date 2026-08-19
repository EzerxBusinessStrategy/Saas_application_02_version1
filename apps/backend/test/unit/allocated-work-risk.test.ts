import { describe, expect, it } from "vitest";
import {
  allocatedWorkAtRiskReasons,
  allocatedWorkStatusMatches,
} from "../../src/platform/allocated-work-risk";

describe("allocatedWorkAtRiskReasons", () => {
  it("explains overdue and SLA-breached open work", () => {
    expect(
      allocatedWorkAtRiskReasons({
        status: "assigned",
        slaStatus: "breached",
        plannedDueAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-08-19T00:00:00.000Z"),
      }),
    ).toEqual(["SLA breached.", "Due date has passed."]);
  });

  it("does not flag completed tasks", () => {
    expect(
      allocatedWorkAtRiskReasons({
        status: "completed",
        slaStatus: "breached",
        plannedDueAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-08-19T00:00:00.000Z"),
      }),
    ).toEqual([]);
  });
});

describe("allocatedWorkStatusMatches", () => {
  it("maps filter groups onto task statuses", () => {
    expect(allocatedWorkStatusMatches("assigned", "open")).toBe(true);
    expect(allocatedWorkStatusMatches("in_progress", "in_progress")).toBe(true);
    expect(allocatedWorkStatusMatches("tenant_approval", "review")).toBe(true);
    expect(allocatedWorkStatusMatches("completed", "completed")).toBe(true);
    expect(allocatedWorkStatusMatches("assigned", "overdue")).toBe(true);
    expect(allocatedWorkStatusMatches("completed", "overdue")).toBe(false);
    expect(allocatedWorkStatusMatches("cancelled", "all")).toBe(false);
  });
});
