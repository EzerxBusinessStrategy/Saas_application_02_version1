import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { createTenantDocumentSchema } from "../../src/platform/tenant-admin-finance.dto";

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
    expect(source).toContain("jsonb_build_object('clientId', $4::uuid, 'requestFeedback', true)");
    expect(source).toContain("jsonb_build_object('clientId', $4::uuid, 'documentId', $3::uuid, 'title', $5::text)");
  });

  test("lists documents without a related client and notifies the client only when one is selected", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.repository.ts"), "utf8");

    expect(source).toContain("left join public.clients c on c.id = d.client_id and c.tenant_id = d.tenant_id");
    expect(source).toContain("coalesce(c.display_name, 'Not linked')");
    expect(source).toContain("'clientVisible', $14::boolean");
    expect(source).toContain("input.clientId ?? null");
    expect(source).toMatch(/if \(input\.clientId\) \{\s*await this\.assertClient/);
    expect(source).toMatch(/if \(input\.clientId\) \{\s*await this\.notifyClientDeliverableShared/);
  });

  test("accepts employee-only documents and still requires a client for agreements", () => {
    const employeeId = "11111111-1111-4111-8111-111111111111";
    const clientId = "22222222-2222-4222-8222-222222222222";
    const base = {
      title: "Policy note",
      fileName: "policy.pdf",
      fileType: "PDF",
      sizeBytes: 12,
      storageKey: "tenants/tenant-1/internal/tenant/policy.pdf",
      contentType: "application/pdf",
    };

    expect(createTenantDocumentSchema.parse({
      ...base,
      recipientEmployeeIds: [employeeId],
    }).clientId).toBeUndefined();
    expect(createTenantDocumentSchema.parse({
      ...base,
      clientId,
    }).recipientEmployeeIds).toEqual([]);
    expect(createTenantDocumentSchema.safeParse(base).success).toBe(false);
    expect(createTenantDocumentSchema.safeParse({
      ...base,
      category: "agreement",
      recipientEmployeeIds: [employeeId],
    }).success).toBe(false);
    expect(createTenantDocumentSchema.parse({
      ...base,
      category: "agreement",
      clientId,
      validUntil: "2026-12-31T23:59:59.000Z",
    }).clientId).toBe(clientId);
    expect(createTenantDocumentSchema.safeParse({
      ...base,
      category: "agreement",
      clientId,
    }).success).toBe(false);
  });

  test("persists agreement expiry metadata and enforces client portal access checks", () => {
    const financeSource = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.repository.ts"), "utf8");
    const deliverablesSource = readFileSync(resolve(__dirname, "../../src/platform/client-portal-deliverables.repository.ts"), "utf8");

    expect(financeSource).toContain("'validUntil', nullif($15::text, '')");
    expect(financeSource).toContain("agreement_access_status");
    expect(deliverablesSource).toContain("AGREEMENT_EXPIRED");
    expect(deliverablesSource).toContain("access_status");
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
