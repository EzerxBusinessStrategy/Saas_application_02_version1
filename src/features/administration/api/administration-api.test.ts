import { afterEach, expect, test, vi } from "vitest";
import { listAuditRecords } from "@/features/administration/api/administration-api";

afterEach(() => {
  vi.restoreAllMocks();
});

test("loads audit records from the real Super Admin audit API route", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        items: [],
        page: 1,
        pageSize: 10,
        pageCount: 1,
        totalItems: 0,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );

  const response = await listAuditRecords({
    page: 1,
    pageSize: 10,
    sort: "timestamp",
    query: "tenant",
  });

  expect(response.items).toEqual([]);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/audit-log?page=1&pageSize=10&query=tenant&sort=timestamp",
    { cache: "no-store" },
  );
});
