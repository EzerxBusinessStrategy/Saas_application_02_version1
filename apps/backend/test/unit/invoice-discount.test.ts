import { describe, expect, it } from "vitest";
import { calculateDiscount, distributeDiscount, toStoredDiscountType } from "../../src/platform/invoice-discount";

describe("invoice discount distribution", () => {
  it("keeps grouped item nets equal to the invoice total", () => {
    const discount = calculateDiscount(4500, "percentage", 10);
    expect(discount).toBe(450);
    const shares = distributeDiscount([2000, 2500], discount);
    expect(shares).toEqual([200, 250]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(discount);
    expect(4500 - shares.reduce((sum, value) => sum + value, 0)).toBe(4050);
  });

  it("assigns leftover cents so the item discounts still sum exactly", () => {
    const shares = distributeDiscount([100, 100, 100], 1);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(shares.every((value) => value === 0.33 || value === 0.34)).toBe(true);
  });

  it("stores API fixed discounts as the billable-entry fixed_amount value", () => {
    expect(toStoredDiscountType("fixed")).toBe("fixed_amount");
    expect(toStoredDiscountType("percentage")).toBe("percentage");
    expect(toStoredDiscountType(undefined)).toBeNull();
  });
});
