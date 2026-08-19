export type InvoicePdfLineItem = {
  readonly description: string;
  readonly quantity: number;
  readonly unitRate: number;
  readonly amount: number;
};

export type InvoicePdfSource = {
  readonly invoiceNumber: string;
  readonly clientName: string;
  readonly serviceName?: string | null;
  readonly billingLabel?: string | null;
  readonly taskTitle?: string | null;
  readonly items?: readonly InvoicePdfLineItem[] | null;
  readonly issuedOn: string;
  readonly dueOn: string | null;
  readonly currency: string;
  readonly subtotalAmount?: number | null;
  readonly discountAmount?: number | null;
  readonly amount: number;
};

export function createInvoicePdf(source: InvoicePdfSource): Buffer {
  const items = resolvePdfItems(source);
  const lines: Array<{ text: string; size: number; y: number }> = [
    { text: "SaaS App", size: 20, y: 800 },
    { text: "INVOICE", size: 16, y: 772 },
    { text: `Invoice: ${source.invoiceNumber}`, size: 11, y: 742 },
    { text: `Client: ${source.clientName}`, size: 11, y: 724 },
  ];
  let y = 706;
  if (source.serviceName) {
    lines.push({ text: source.serviceName, size: 11, y });
    y -= 18;
  }
  if (source.billingLabel) {
    lines.push({ text: source.billingLabel, size: 10, y });
    y -= 22;
  } else {
    y -= 8;
  }

  lines.push({ text: "DESCRIPTION             QTY       RATE        AMOUNT", size: 9, y });
  y -= 16;
  for (const item of items) {
    if (y < 160) break;
    lines.push({
      text: `${truncate(item.description, 22).padEnd(22)} ${formatQty(item.quantity).padStart(5)} ${formatMoney(source.currency, item.unitRate).padStart(11)} ${formatMoney(source.currency, item.amount).padStart(12)}`,
      size: 10,
      y,
    });
    y -= 16;
  }

  const subtotal = source.subtotalAmount ?? items.reduce((sum, item) => sum + item.amount, 0);
  const discount = source.discountAmount ?? Math.max(0, roundMoney(subtotal - source.amount));
  y -= 8;
  lines.push({ text: `Subtotal ${formatMoney(source.currency, subtotal)}`, size: 11, y });
  y -= 16;
  if (discount > 0) {
    lines.push({ text: `Discount ${formatMoney(source.currency, discount)}`, size: 11, y });
    y -= 16;
  }
  lines.push({ text: `TOTAL ${formatMoney(source.currency, source.amount)}`, size: 14, y });
  y -= 28;
  lines.push({ text: `Invoice date: ${source.issuedOn}`, size: 11, y });
  y -= 18;
  lines.push({ text: `Payment due: ${source.dueOn ?? "Not set"}`, size: 11, y });
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
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

function resolvePdfItems(source: InvoicePdfSource): readonly InvoicePdfLineItem[] {
  if (source.items && source.items.length > 0) {
    return source.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unitRate: Number(item.unitRate) || 0,
      amount: Number(item.amount) || 0,
    }));
  }
  if (source.taskTitle) {
    return [{ description: source.taskTitle, quantity: 1, unitRate: source.amount, amount: source.amount }];
  }
  return [{ description: "Professional services", quantity: 1, unitRate: source.amount, amount: source.amount }];
}

function formatMoney(currency: string, amount: number): string {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(quantity);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 3))}...`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
