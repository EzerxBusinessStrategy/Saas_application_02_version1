import { expect, test } from "vitest";
import { listAuditRecords } from "@/features/administration/api/administration-api";

test("scopes tenant audit records before pagination", async () => {
  const response = await listAuditRecords(
    { page: 1, pageSize: 10, sort: "timestamp" },
    { tenantName: "SaaS App" },
  );

  expect(response.totalItems).toBeGreaterThan(0);
  expect(response.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ tenant: "SaaS App" }),
    ]),
  );
  expect(
    response.items.every((record) => record.tenant === "SaaS App"),
  ).toBe(true);
});
