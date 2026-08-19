import { describe, expect, it } from "vitest";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

describe("invoice PDF download", () => {
  it("renders each grouped task from the finance invoice payload", () => {
    const pdf = renderInvoicePdf({
      id: "invoice-1",
      invoiceNumber: "INV/26-27/0042",
      client: "Acme Operations",
      serviceName: "GST Compliance",
      billingLabel: "Monthly · August 2026",
      taskTitle: "GSTR-1, GSTR-3B",
      items: [
        { description: "GSTR-1", quantity: 1, unitRate: 2000, netAmount: 1800, amount: 1800 },
        { description: "GSTR-3B", quantity: 1, unitRate: 2500, netAmount: 2250, amount: 2250 },
      ],
      issuedOn: "2026-08-19",
      dueOn: "2026-09-03",
      currency: "INR",
      subtotalAmount: 4500,
      discountAmount: 450,
      amount: 4050,
      updatedOn: "2026-08-19T00:00:00.000Z",
    });

    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("GSTR-1");
    expect(pdf).toContain("GSTR-3B");
    expect(pdf).toContain("INR 1,800");
    expect(pdf).toContain("INR 2,250");
    expect(pdf).toContain("GST Compliance");
    expect(pdf).toContain("Monthly");
    expect(pdf).toContain("TOTAL INR 4,050");
    expect(pdf).not.toContain("GSTR-1, GSTR-3B");
  });
});
