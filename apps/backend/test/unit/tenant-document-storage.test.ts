import { describe, expect, it } from "vitest";
import { TenantDocumentStorageService } from "../../src/platform/tenant-document-storage.service";

describe("TenantDocumentStorageService", () => {
  it("does not initialize Supabase Auth for the server-only storage client", () => {
    const service = new TenantDocumentStorageService({
      supabaseUrl: "https://example.supabase.co",
      supabaseAdminKey: "storage-service-key",
    } as never) as unknown as {
      client: { auth: { initializePromise: Promise<unknown> | null } };
    };

    expect(service.client.auth.initializePromise).toBeNull();
  });

  it("accepts the standard XLSX MIME type", () => {
    const service = new TenantDocumentStorageService({} as never) as unknown as {
      assertFileMetadata(fileName: string, contentType: string, sizeBytes: number): void;
    };

    expect(() => service.assertFileMetadata(
      "workbook.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      128,
    )).not.toThrow();
  });
});
