import { expect, test } from "vitest";
import { platformOverview } from "@/mocks/platform-overview";

test("contains all required platform metrics", () => {
  expect(platformOverview.metrics.map((metric) => metric.label)).toEqual([
    "Total tenants",
    "Active tenants",
    "Suspended tenants",
    "Tenant reviews",
    "Active platform users",
  ]);
});
