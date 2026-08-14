import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Client portal deliverables", () => {
  test("does not permit client approval decisions for invoices", () => {
    const source = readFileSync(
      resolve(__dirname, "../../src/platform/client-portal-deliverables.repository.ts"),
      "utf8",
    );

    expect(source).toContain("and d.category <> 'invoice'");
  });

  test("excludes invoices from the client deliverables listing", () => {
    const source = readFileSync(
      resolve(__dirname, "../../src/platform/client-portal-deliverables.repository.ts"),
      "utf8",
    );

    expect(source).toContain("and d.category <> 'invoice'");
    expect(source).toContain("getInvoiceDownloadableDocument");
  });
});
