import { describe, expect, test } from "vitest";
import { calculateTaskBillingPreview } from "@/components/operations/tasks-page";

describe("calculateTaskBillingPreview", () => {
  test("calculates an immediate percentage discount and effective amount", () => {
    expect(calculateTaskBillingPreview(100000, "percentage", "20")).toEqual({
      grossAmount: 100000,
      discountAmount: 20000,
      effectiveAmount: 80000,
    });
  });

  test("caps a fixed discount at the gross amount", () => {
    expect(calculateTaskBillingPreview(1000, "fixed", "1200")).toEqual({
      grossAmount: 1000,
      discountAmount: 1000,
      effectiveAmount: 0,
    });
  });
});
