import type { SharedInvoice } from "@/types/operations";

type InvoicePdfLineItem = {
  readonly description: string;
  readonly quantity: number;
  readonly unitRate: number;
  readonly amount?: number;
  readonly netAmount?: number;
};

type ResolvedInvoicePdfLineItem = {
  readonly description: string;
  readonly quantity: number;
  readonly unitRate: number;
  readonly amount: number;
};

type InvoicePdfSource = Pick<
  SharedInvoice,
  "id" | "invoiceNumber" | "client" | "taskTitle" | "issuedOn" | "dueOn" | "currency" | "amount" | "updatedOn"
> & {
  readonly serviceName?: string | null;
  readonly billingLabel?: string | null;
  readonly items?: readonly InvoicePdfLineItem[] | null;
  readonly subtotalAmount?: number | null;
  readonly discountAmount?: number | null;
};

const storagePrefix = "saas-app:invoice-pdf:";

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatMoney(currency: string, amount: number) {
  return `${currency} ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`;
}

function resolvePdfItems(invoice: InvoicePdfSource): readonly ResolvedInvoicePdfLineItem[] {
  if (invoice.items && invoice.items.length > 0) {
    return invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitRate: item.unitRate,
      amount: item.amount ?? item.netAmount ?? 0,
    }));
  }
  if (invoice.taskTitle) {
    return [{ description: invoice.taskTitle, quantity: 1, unitRate: invoice.amount, amount: invoice.amount }];
  }
  return [{ description: "Professional services", quantity: 1, unitRate: invoice.amount, amount: invoice.amount }];
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}?`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildInvoicePdf(invoice: InvoicePdfSource) {
  const items = resolvePdfItems(invoice);
  const lines: Array<{ text: string; size: number; y: number }> = [
    { text: "SaaS App", size: 20, y: 800 },
    { text: "INVOICE", size: 16, y: 772 },
    { text: `Invoice: ${invoice.invoiceNumber}`, size: 11, y: 742 },
    { text: `Client: ${invoice.client}`, size: 11, y: 724 },
  ];
  let y = 706;
  if (invoice.serviceName) {
    lines.push({ text: invoice.serviceName, size: 11, y });
    y -= 18;
  }
  if (invoice.billingLabel) {
    lines.push({ text: invoice.billingLabel, size: 10, y });
    y -= 22;
  } else {
    y -= 8;
  }
  lines.push({ text: "DESCRIPTION             QTY       RATE        AMOUNT", size: 9, y });
  y -= 16;
  for (const item of items) {
    if (y < 160) break;
    lines.push({
      text: `${truncate(item.description, 22).padEnd(22)} ${String(item.quantity).padStart(5)} ${formatMoney(invoice.currency, item.unitRate).padStart(11)} ${formatMoney(invoice.currency, item.amount).padStart(12)}`,
      size: 10,
      y,
    });
    y -= 16;
  }
  const subtotal = invoice.subtotalAmount ?? items.reduce((sum, item) => sum + item.amount, 0);
  const discount = invoice.discountAmount ?? Math.max(0, roundMoney(subtotal - invoice.amount));
  y -= 8;
  lines.push({ text: `Subtotal ${formatMoney(invoice.currency, subtotal)}`, size: 11, y });
  y -= 16;
  if (discount > 0) {
    lines.push({ text: `Discount ${formatMoney(invoice.currency, discount)}`, size: 11, y });
    y -= 16;
  }
  lines.push({ text: `TOTAL ${formatMoney(invoice.currency, invoice.amount)}`, size: 14, y });
  y -= 28;
  lines.push({ text: `Invoice date: ${invoice.issuedOn}`, size: 11, y });
  y -= 18;
  lines.push({ text: `Payment due: ${invoice.dueOn || "Not set"}`, size: 11, y });
  lines.push({
    text: "This invoice was generated from your authorised SaaS App record.",
    size: 9,
    y: 72,
  });

  const content = lines
    .map(({ text, size, y: lineY }) => `BT /F1 ${size} Tf 72 ${lineY} Td (${escapePdfText(text)}) Tj ET`)
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
  return `${storagePrefix}v2:${invoice.id}:${invoice.updatedOn}:${invoice.items?.length ?? 0}`;
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

export function renderInvoicePdf(invoice: InvoicePdfSource) {
  return buildInvoicePdf(invoice);
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
