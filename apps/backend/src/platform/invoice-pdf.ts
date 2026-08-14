export type InvoicePdfSource = {
  readonly invoiceNumber: string;
  readonly clientName: string;
  readonly taskTitle: string | null;
  readonly issuedOn: string;
  readonly dueOn: string | null;
  readonly currency: string;
  readonly amount: number;
};

export function createInvoicePdf(source: InvoicePdfSource): Buffer {
  const lines = [
    { text: "SaaS App", size: 20, y: 760 },
    { text: "INVOICE", size: 16, y: 724 },
    { text: `Invoice: ${source.invoiceNumber}`, size: 11, y: 690 },
    { text: `Client: ${source.clientName}`, size: 11, y: 670 },
    { text: `Task: ${source.taskTitle ?? "Not linked to a task"}`, size: 11, y: 650 },
    { text: `Issued: ${source.issuedOn}`, size: 11, y: 630 },
    { text: `Due: ${source.dueOn ?? "Not set"}`, size: 11, y: 610 },
    { text: `Total: ${formatAmount(source)}`, size: 14, y: 564 },
    { text: "This invoice was generated from your authorised SaaS App record.", size: 9, y: 96 },
  ];
  const content = lines
    .map(({ text, size, y }) => `BT /F1 ${size} Tf 72 ${y} Td (${escapePdfText(text)}) Tj ET`)
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

function formatAmount(source: InvoicePdfSource): string {
  return `${source.currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(source.amount)}`;
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
