import { ConflictException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { createTenantDocumentSchema, createEntriesInvoiceSchema } from "../../src/platform/tenant-admin-finance.dto";
import { TenantAdminFinanceRepository } from "../../src/platform/tenant-admin-finance.repository";

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
    expect(source).toContain("d.category <> 'invoice'");
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
    expect(createTenantDocumentSchema.safeParse({
      ...base,
      category: "invoice",
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
    const tenantFinanceServiceSource = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.service.ts"), "utf8");

    expect(storageSource).toContain("storeGeneratedInvoice");
    expect(storageSource).toContain("invoices/${input.invoiceId}.pdf");
    expect(clientDeliverablesSource).toContain("getDownloadableDocument");
    expect(clientDeliverablesSource).toContain("attachGeneratedInvoiceStorageObject");
    expect(tenantFinanceServiceSource).toContain("getDownloadableDocument");
    expect(tenantFinanceServiceSource).toContain("storeGeneratedInvoice");
    expect(tenantFinanceServiceSource).toContain("attachGeneratedInvoiceStorageObject");
  });

  test("generates a downloadable invoice when the sent invoice has no stored file", async () => {
    type QueryClient = {
      query(sqlText: string, params: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };
    const queries: string[] = [];
    const client: QueryClient = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[]) => {
        queries.push(sqlText);
        expect(values).toEqual(["tenant-1", "document-1", "membership-1"]);
        return {
          rows: [
            {
              id: "document-1",
              client_id: "client-1",
              category: "invoice",
              storage_bucket: null,
              storage_key: null,
              invoice_id: "invoice-1",
              invoice_number: "1252",
              client_name: "Acme Operations",
              task_title: "GST filing",
              issued_on: "2026-08-17",
              due_on: null,
              currency: "INR",
              amount: 1200,
            },
          ],
        };
      }),
    };
    const repository = new TenantAdminFinanceRepository(null);
    const resolveDownloadableDocument = (
      repository as unknown as {
        resolveDownloadableDocument(
          queryClient: QueryClient,
          tenantId: string,
          membershipId: string,
          documentId: string,
        ): Promise<unknown>;
      }
    ).resolveDownloadableDocument.bind(repository);

    const result = await resolveDownloadableDocument(client, "tenant-1", "membership-1", "document-1");

    expect(queries.join("\n")).toContain("d.tenant_id = $1");
    expect(queries.join("\n")).toContain("d.id = $2");
    expect(result).toMatchObject({
      kind: "generated-invoice",
      documentId: "document-1",
      invoiceNumber: "1252",
      clientName: "Acme Operations",
    });
  });

  test("keeps stored files as signed-download objects", async () => {
    type QueryClient = {
      query(sqlText: string, params: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };
    const client: QueryClient = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: "document-2",
            client_id: "client-1",
            category: "supporting",
            storage_bucket: "tenant-documents",
            storage_key: "tenants/tenant-1/clients/client-1/tenant/file.pdf",
            invoice_id: null,
            invoice_number: null,
            client_name: "Acme Operations",
            task_title: null,
            issued_on: null,
            due_on: null,
            currency: null,
            amount: null,
          },
        ],
      })),
    };
    const repository = new TenantAdminFinanceRepository(null);
    const resolveDownloadableDocument = (
      repository as unknown as {
        resolveDownloadableDocument(
          queryClient: QueryClient,
          tenantId: string,
          membershipId: string,
          documentId: string,
        ): Promise<unknown>;
      }
    ).resolveDownloadableDocument.bind(repository);

    await expect(resolveDownloadableDocument(client, "tenant-1", "membership-1", "document-2")).resolves.toEqual({
      kind: "stored",
      object: {
        storageBucket: "tenant-documents",
        storageKey: "tenants/tenant-1/clients/client-1/tenant/file.pdf",
      },
    });
  });

  test("does not leak missing documents as a distinct not-found error", async () => {
    type QueryClient = {
      query(sqlText: string, params: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    };
    const client: QueryClient = {
      query: vi.fn(async () => ({ rows: [] })),
    };
    const repository = new TenantAdminFinanceRepository(null);
    const resolveDownloadableDocument = (
      repository as unknown as {
        resolveDownloadableDocument(
          queryClient: QueryClient,
          tenantId: string,
          membershipId: string,
          documentId: string,
        ): Promise<unknown>;
      }
    ).resolveDownloadableDocument.bind(repository);

    await expect(resolveDownloadableDocument(client, "tenant-1", "membership-1", "missing")).rejects.toBeInstanceOf(ConflictException);
  });

  test("creates grouped invoices from approved charges in one transaction", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.repository.ts"), "utf8");
    const dtoSource = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.dto.ts"), "utf8");
    const controllerSource = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-finance.controller.ts"), "utf8");

    expect(controllerSource).toContain('Post("invoices/from-entries")');
    expect(controllerSource).toContain('Get("billing-groups")');
    expect(dtoSource).toContain("billableTaskEntryIds");
    expect(source).toContain("for update of bte");
    expect(source).toContain("BILLING_GROUP_INCOMPLETE");
    expect(source).toContain("BILLING_GROUP_MISMATCH");
    expect(source).toContain("INVOICE_CREATED_FROM_ENTRIES");
    expect(source).toContain("and t.status <> 'cancelled'");
    expect(source).toContain("approved_for_invoice");
    expect(source).toContain("BILLABLE_TASK_NOT_AVAILABLE");
    expect(source).toContain("isUniqueViolation");
  });

  test("rejects duplicate charge ids on grouped invoice creation", () => {
    const parsed = createEntriesInvoiceSchema.safeParse({
      billableTaskEntryIds: [
        "11111111-1111-4111-8111-111111111111",
        "11111111-1111-4111-8111-111111111111",
      ],
      invoiceNumber: "INV-1",
      issuedOn: "2026-08-19",
      dueOn: "2026-09-03",
    });
    expect(parsed.success).toBe(false);
  });
});
