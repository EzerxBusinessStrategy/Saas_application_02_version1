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

  test("renders grouped invoice line items, subtotal and payment due", () => {
    const pdf = createInvoicePdf({
      invoiceNumber: "INV/26-27/0042",
      clientName: "Acme Operations",
      serviceName: "GST Compliance",
      billingLabel: "Monthly · August 2026",
      items: [
        { description: "GSTR-1", quantity: 1, unitRate: 2000, amount: 2000 },
        { description: "GSTR-3B", quantity: 1, unitRate: 2500, amount: 2500 },
      ],
      issuedOn: "2026-08-19",
      dueOn: "2026-09-03",
      currency: "INR",
      subtotalAmount: 4500,
      discountAmount: 450,
      amount: 4050,
    });

    const text = pdf.toString("ascii");
    expect(text).toContain("GSTR-1");
    expect(text).toContain("GSTR-3B");
    expect(text).toContain("Subtotal");
    expect(text).toContain("Discount");
    expect(text).toContain("Payment due: 2026-09-03");
  });

  test("download mapping keeps each grouped task as its own PDF line", () => {
    const storedItems = [
      { description: "GSTR-1", quantity: 1, unitRate: 2000, grossAmount: 2000, discountAmount: 200, netAmount: 1800, taskDueOn: "2026-08-11" },
      { description: "GSTR-3B", quantity: 1, unitRate: 2500, grossAmount: 2500, discountAmount: 250, netAmount: 2250, taskDueOn: "2026-08-20" },
    ];
    const pdf = createInvoicePdf({
      invoiceNumber: "INV/26-27/0042",
      clientName: "Acme Operations",
      serviceName: "GST Compliance",
      billingLabel: "Monthly · August 2026",
      taskTitle: "GSTR-1, GSTR-3B",
      items: storedItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitRate: item.unitRate,
        amount: item.netAmount,
      })),
      issuedOn: "2026-08-19",
      dueOn: "2026-09-03",
      currency: "INR",
      subtotalAmount: 4500,
      discountAmount: 450,
      amount: 4050,
    });

    const text = pdf.toString("ascii");
    expect(text).toContain("GSTR-1");
    expect(text).toContain("GSTR-3B");
    expect(text).toContain("INR 1,800");
    expect(text).toContain("INR 2,250");
    expect(text).toContain("TOTAL INR 4,050");
    expect(text).not.toContain("GSTR-1, GSTR-3B");
  });
});
