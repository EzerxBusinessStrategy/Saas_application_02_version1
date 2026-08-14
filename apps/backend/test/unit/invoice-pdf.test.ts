import { describe, expect, test } from "vitest";
import { createInvoicePdf } from "../../src/platform/invoice-pdf";

describe("createInvoicePdf", () => {
  test("creates a valid PDF payload from the authorised invoice data", () => {
    const pdf = createInvoicePdf({
      invoiceNumber: "INV-1001",
      clientName: "Acme Operations",
      taskTitle: "GST Filing",
      issuedOn: "2026-08-14",
      dueOn: "2026-08-21",
      currency: "INR",
      amount: 100000,
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.toString("ascii")).toContain("INV-1001");
    expect(pdf.toString("ascii")).toContain("Acme Operations");
  });
});
