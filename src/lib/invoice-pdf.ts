import type { SharedInvoice } from "@/types/operations";

type InvoicePdfSource = Pick<
  SharedInvoice,
  "id" | "invoiceNumber" | "client" | "taskTitle" | "issuedOn" | "dueOn" | "currency" | "amount" | "updatedOn"
>;

const storagePrefix = "saas-app:invoice-pdf:";

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatAmount(invoice: InvoicePdfSource) {
  return `${invoice.currency} ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(invoice.amount)}`;
}

function buildInvoicePdf(invoice: InvoicePdfSource) {
  const lines = [
    { text: "SaaS App", size: 20, y: 760 },
    { text: "INVOICE", size: 16, y: 724 },
    { text: `Invoice: ${invoice.invoiceNumber}`, size: 11, y: 690 },
    { text: `Client: ${invoice.client}`, size: 11, y: 670 },
    { text: `Task: ${invoice.taskTitle ?? "Not linked to a task"}`, size: 11, y: 650 },
    { text: `Issued: ${invoice.issuedOn}`, size: 11, y: 630 },
    { text: `Due: ${invoice.dueOn || "Not set"}`, size: 11, y: 610 },
    { text: `Total: ${formatAmount(invoice)}`, size: 14, y: 564 },
    { text: "This invoice was generated from your authorised SaaS App record.", size: 9, y: 96 },
  ];
  const content = lines
    .map(({ text, size, y }) => `BT /F1 ${size} Tf 72 ${y} Td (${escapePdfText(text)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function cacheKey(invoice: InvoicePdfSource) {
  return `${storagePrefix}${invoice.id}:${invoice.updatedOn}`;
}

function getPdfBlob(invoice: InvoicePdfSource) {
  const key = cacheKey(invoice);
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) return new Blob([window.atob(cached)], { type: "application/pdf" });
      const pdf = buildInvoicePdf(invoice);
      window.localStorage.setItem(key, window.btoa(pdf));
      return new Blob([pdf], { type: "application/pdf" });
    } catch {
      // Local storage can be unavailable or full; the invoice record remains the source of truth.
    }
  }
  return new Blob([buildInvoicePdf(invoice)], { type: "application/pdf" });
}

export function createInvoicePdfUrl(invoice: InvoicePdfSource) {
  return URL.createObjectURL(getPdfBlob(invoice));
}

export function downloadInvoicePdf(invoice: InvoicePdfSource) {
  const url = createInvoicePdfUrl(invoice);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${invoice.invoiceNumber}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
