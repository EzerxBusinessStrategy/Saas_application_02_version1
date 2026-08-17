import { expect, test } from "vitest";
import { summarizeClientServicePricing } from "../../src/platform/client-service-pricing";

test("package total is the listed task prices and discount is applied after that total", () => {
  const summary = summarizeClientServicePricing(
    Array.from({ length: 8 }, () => ({ rateAmount: 100_000, discountAmount: 2_500 })),
  );

  expect(summary.taskTotal).toBe(800_000);
  expect(summary.discountAmount).toBe(20_000);
  expect(summary.discountPercent).toBe(2.5);
  expect(summary.amountDue).toBe(780_000);
});
