import { expect, test } from "vitest";
import {
  formatDiscountPercent,
  formatMonthLabel,
  summarizeClientServicePricing,
  summarizeClientServiceSchedule,
} from "@/features/client-portal/client-service-pricing";

test("sums listed task prices and applies the tenant-provided discount percent after the total", () => {
  const summary = summarizeClientServicePricing(
    Array.from({ length: 8 }, () => ({ rateAmount: 100_000 })),
    2.5,
  );

  expect(summary.taskTotal).toBe(800_000);
  expect(summary.discountAmount).toBe(20_000);
  expect(summary.discountPercent).toBe(2.5);
  expect(summary.amountDue).toBe(780_000);
  expect(formatDiscountPercent(summary.discountPercent)).toBe("2.5%");
});

test("omits discount when the tenant did not provide one", () => {
  const summary = summarizeClientServicePricing([
    { rateAmount: 10_000 },
    { rateAmount: 150_000 },
  ]);

  expect(summary.taskTotal).toBe(160_000);
  expect(summary.discountAmount).toBe(0);
  expect(summary.discountPercent).toBe(0);
  expect(summary.amountDue).toBe(160_000);
});

test("this month due is remaining open work in the current month and next month is the following installment", () => {
  const now = new Date("2026-08-17T06:00:00.000Z");
  const summary = summarizeClientServiceSchedule(
    [
      {
        rateAmount: 100_000,
        plannedDueAt: "2026-08-28T00:00:00.000Z",
        status: "completed",
      },
      {
        rateAmount: 100_000,
        plannedDueAt: "2026-09-11T00:00:00.000Z",
        status: "assigned",
      },
      {
        rateAmount: 100_000,
        plannedDueAt: "2026-10-11T00:00:00.000Z",
        status: "assigned",
      },
    ],
    0,
    now,
  );

  expect(summary.thisMonthKey).toBe("2026-08");
  expect(summary.nextMonthKey).toBe("2026-09");
  expect(summary.thisMonthDue).toBe(0);
  expect(summary.nextMonthDue).toBe(100_000);
  expect(summary.taskTotal).toBe(300_000);
  expect(formatMonthLabel(summary.nextMonthKey)).toMatch(/2026/);
  expect(formatMonthLabel(summary.nextMonthKey).toLowerCase()).toContain("sep");
});
