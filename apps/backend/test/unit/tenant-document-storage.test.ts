import { describe, expect, it } from "vitest";
import { TenantDocumentStorageService } from "../../src/platform/tenant-document-storage.service";

describe("TenantDocumentStorageService", () => {
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
