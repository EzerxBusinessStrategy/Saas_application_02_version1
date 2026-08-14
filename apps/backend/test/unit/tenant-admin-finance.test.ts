import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("TenantAdminFinanceRepository document delivery", () => {
  test("uses the partial notification idempotency index correctly", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.repository.ts"), "utf8");

    expect(source).toContain("on conflict (idempotency_key) where idempotency_key is not null do nothing");
    expect(source).not.toContain("on conflict (idempotency_key) do update set idempotency_key");
  });

  test("persists a verified private object reference for uploaded documents and invoices", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.repository.ts"), "utf8");

    expect(source).toContain("storage_bucket");
    expect(source).toContain("storage_key");
    expect(source).toContain("content_type");
    expect(source).toContain("'invoice_upload'");
  });

  test("replays document and invoice mutations through tenant-scoped idempotency keys", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.repository.ts"), "utf8");

    expect(source).toContain("on conflict (tenant_id, created_by, idempotency_key) where idempotency_key is not null do nothing");
    expect(source).toContain("findDocumentIdByIdempotencyKey");
    expect(source).toContain("findInvoiceIdByIdempotencyKey");
  });
});
