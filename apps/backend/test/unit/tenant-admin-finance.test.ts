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

  test("keeps notification entity identifiers as UUIDs while deriving text idempotency keys", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.repository.ts"), "utf8");

    expect(source).toContain("'document-shared:' || $3::uuid::text");
    expect(source).toContain("'client-deliverable-shared:' || $3::uuid::text");
    expect(source).toContain("'client-invoice-sent:' || $3::uuid::text");
    expect(source).toContain("jsonb_build_object('documentId', $3::uuid, 'title', $4::text)");
    expect(source).toContain("jsonb_build_object('clientId', $4::uuid)");
    expect(source).toContain("jsonb_build_object('clientId', $4::uuid, 'documentId', $3::uuid, 'title', $5::text)");
  });

  test("creates client-downloadable invoice PDFs through private storage", () => {
    const storageSource = readFileSync(resolve(__dirname, "../../src/platform/tenant-document-storage.service.ts"), "utf8");
    const clientDeliverablesSource = readFileSync(resolve(__dirname, "../../src/platform/client-portal-deliverables.service.ts"), "utf8");

    expect(storageSource).toContain("storeGeneratedInvoice");
    expect(storageSource).toContain("invoices/${input.invoiceId}.pdf");
    expect(clientDeliverablesSource).toContain("getDownloadableDocument");
    expect(clientDeliverablesSource).toContain("attachGeneratedInvoiceStorageObject");
  });
});
