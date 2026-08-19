import { describe, expect, it } from "vitest";
import {
  billingGroupStatus,
  billingPeriodDisplayLabel,
  resolveBillingPeriodKey,
} from "../../src/platform/billing-charge-period";

describe("billing charge period", () => {
  it("stores monthly and quarterly keys without parsing task titles", () => {
    expect(resolveBillingPeriodKey({
      frequency: "monthly",
      periodLabel: "2026-08",
      taskId: "task-1",
    })).toBe("2026-08");
    expect(resolveBillingPeriodKey({
      frequency: "quarterly",
      periodLabel: "Q3 2026",
      taskId: "task-1",
    })).toBe("2026-Q3");
  });

  it("uses the financial year for annual groups and the task id for one-time work", () => {
    expect(resolveBillingPeriodKey({
      frequency: "annually",
      periodLabel: "2026",
      taskId: "task-1",
      financialYearLabel: "FY 2026-27",
      financialYearStartsOn: "2026-04-01",
      financialYearEndsOn: "2027-03-31",
    })).toBe("FY-2026-27");
    expect(resolveBillingPeriodKey({
      frequency: "one_time",
      periodLabel: "2026-08-19",
      taskId: "task-registration",
    })).toBe("task-registration");
  });

  it("hides empty groups, waits for incomplete groups, and marks complete groups ready", () => {
    expect(billingGroupStatus(0, 2)).toBe("hidden");
    expect(billingGroupStatus(1, 2)).toBe("waiting");
    expect(billingGroupStatus(2, 2)).toBe("ready");
    expect(billingPeriodDisplayLabel("monthly", "2026-08")).toBe("August 2026");
  });
});
