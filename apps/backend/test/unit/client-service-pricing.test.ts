import { expect, test } from "vitest";
import { summarizeClientServicePricing } from "../../src/platform/client-service-pricing";

test("package total is the listed task prices and the tenant-provided percent is applied after that total", () => {
  const summary = summarizeClientServicePricing(
    Array.from({ length: 8 }, () => ({ rateAmount: 100_000 })),
    2.5,
  );

  expect(summary.taskTotal).toBe(800_000);
  expect(summary.discountAmount).toBe(20_000);
  expect(summary.discountPercent).toBe(2.5);
  expect(summary.amountDue).toBe(780_000);
});

test("no discount is shown when the tenant did not provide one", () => {
  const summary = summarizeClientServicePricing(
    Array.from({ length: 8 }, () => ({ rateAmount: 100_000 })),
  );

  expect(summary.taskTotal).toBe(800_000);
  expect(summary.discountAmount).toBe(0);
  expect(summary.discountPercent).toBe(0);
  expect(summary.amountDue).toBe(800_000);
});

test("discount percent is clamped to the valid 0-100 range", () => {
  expect(summarizeClientServicePricing([{ rateAmount: 1_000 }], 150).discountAmount).toBe(1_000);
  expect(summarizeClientServicePricing([{ rateAmount: 1_000 }], -5).discountAmount).toBe(0);
  expect(summarizeClientServicePricing([{ rateAmount: 1_000 }], Number.NaN).discountAmount).toBe(0);
});
