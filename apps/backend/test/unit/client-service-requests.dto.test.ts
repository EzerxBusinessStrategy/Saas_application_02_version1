import { expect, test } from "vitest";
import { acceptClientServiceRequestSchema } from "../../src/platform/client-service-requests.dto";

test("accept allows an optional tenant discount percent between 0 and 100", () => {
  expect(acceptClientServiceRequestSchema.parse({ assignments: [] }).discountPercent).toBeUndefined();
  expect(
    acceptClientServiceRequestSchema.parse({ assignments: [], discountPercent: 2.5 }).discountPercent,
  ).toBe(2.5);
  expect(
    acceptClientServiceRequestSchema.safeParse({ assignments: [], discountPercent: 101 }).success,
  ).toBe(false);
  expect(
    acceptClientServiceRequestSchema.safeParse({ assignments: [], discountPercent: -1 }).success,
  ).toBe(false);
});
