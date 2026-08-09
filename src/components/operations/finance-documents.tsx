"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { FileCheck2, FileText, ReceiptText, Upload, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  createSharedDocument,
  createSharedInvoice,
  createInvoiceFromTask,
  getOperationalWorkspace,
  listTenantBillableTaskEntries,
  listSharedDocuments,
  listSharedInvoices,
  updateSharedDocumentAccess,
  sendTenantInvoice,
  type TenantBillableTaskEntry,
} from "@/features/operations/api/operations-api";
import { listClients } from "@/features/administration/api/administration-api";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { MetricCard } from "@/components/shared/metric-card";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Workspace } from "@/types/domain";
import type { SharedDocument, SharedInvoice } from "@/types/operations";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const demoClients = [
  { id: "northstar", name: "Northstar Labs" },
  { id: "wellspring", name: "Wellspring Co." },
  { id: "bayside", name: "Bayside Health" },
];
const categories = ["agreement", "deliverable", "evidence", "compliance", "finance", "report", "client-upload", "employee-submission", "internal", "supporting", "other"] as const;

export function FinanceDocuments({
  section,
  workspace = "admin",
}: {
  section: "invoices" | "payments" | "agreements" | "documents";
  workspace?: Extract<Workspace, "admin" | "manager" | "employee" | "client">;
}) {
  if (section === "payments")
    return <LegacyFinanceSection section={section} workspace={workspace} />;
  return section === "documents" || section === "agreements" ? <DocumentsWorkspace workspace={workspace} fixedCategory={section === "agreements" ? "agreement" : undefined} /> : <InvoicesWorkspace workspace={workspace as "admin" | "manager" | "client"} />;
}

function DocumentsWorkspace({ workspace, fixedCategory }: { workspace: Extract<Workspace, "admin" | "manager" | "employee" | "client">; fixedCategory?: (typeof categories)[number] }) {
  const [documents, setDocuments] = useState<SharedDocument[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<SharedDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const clientsQuery = useQuery({ queryKey: ["tenant-finance-clients", workspace], queryFn: () => listClients({ page: 1, pageSize: 100 }), enabled: workspace === "admin" });
  const clientOptions = workspace === "admin" ? clientsQuery.data?.items.map((client) => ({ id: client.id, name: client.name })) ?? [] : demoClients;
  const refresh = useCallback(async () => {
    try { setDocuments(await listSharedDocuments(workspace)); setError(false); } catch { setError(true); }
  }, [workspace]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!documents && !error) return <LoadingState label="Loading documents" rows={5} />;
  if (error) return <ErrorState title="Documents could not load" onRetry={() => void refresh()} />;
  const visible = (documents ?? []).filter((document) =>
    (!search || [document.title, document.fileName, document.client, document.category, document.uploadedBy].join(" ").toLowerCase().includes(search.toLowerCase())) &&
    (fixedCategory ? document.category === fixedCategory : !category || document.category === category),
  );
  const canManage = workspace === "admin" || workspace === "manager";
  const columns: ColumnDef<SharedDocument, unknown>[] = [
    { accessorKey: "title", header: "Document", cell: ({ row }) => <button className="text-left font-medium hover:text-primary" onClick={() => setSelected(row.original)}>{row.original.title}<span className="mt-1 block text-xs text-muted-foreground">{row.original.fileType} · {row.original.id}</span></button> },
    { accessorKey: "category", header: "Category" },
    { accessorKey: "client", header: "Client" },
      { accessorKey: "uploadedBy", header: "Uploaded by" },
      { id: "clientDecision", header: "Client decision", cell: ({ row }) => <StatusBadge status={row.original.clientDecisionStatus === "approved" ? "complete" : row.original.clientDecisionStatus === "rejected" ? "at-risk" : "pending"} /> },
      { id: "shared", header: "Shared with", cell: ({ row }) => <RecipientSummary document={row.original} /> },
    { accessorKey: "updatedOn", header: "Updated" },
    { id: "actions", header: "Actions", cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => setSelected(row.original)}>View details</Button> },
  ];
  return <div className="flex flex-col gap-[30px]">
    <PageHeader eyebrow="Operations" title={fixedCategory === "agreement" ? "Agreements" : "Documents"} description={fixedCategory === "agreement" ? "Upload agreements and send them to the selected client." : "Upload, organise and securely share operational documents with authorised users."} actions={workspace === "admin" ? <Button onClick={() => setUploadOpen(true)}><Upload data-icon="inline-start" />{fixedCategory === "agreement" ? "Upload agreement" : "Upload document"}</Button> : undefined} />
    <MetricStrip metrics={[{ label: "All documents", value: String(documents?.length ?? 0) }, { label: "Shared with me", value: String(documents?.filter((item) => item.uploadedByRole !== workspace).length ?? 0) }, { label: "Client documents", value: String(documents?.filter((item) => item.recipientClientIds.length).length ?? 0) }]} />
    <FilterToolbar search={{ value: search, onChange: setSearch, label: "Search documents", placeholder: "Search document name, client, category or uploader" }} activeFilterCount={Number(Boolean(category))} onClear={() => setCategory("")}>
      {!fixedCategory ? <label className="flex flex-col gap-1 text-sm font-medium">Category<Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</Select></label> : null}
    </FilterToolbar>
    <Card><CardContent className="pt-0"><div className="hidden md:block"><DataTable caption="Authorised documents" columns={columns} data={visible} emptyTitle={search || category ? "No documents match these filters" : "No documents yet"} emptyDescription="Upload the first document to securely share files with authorised users." /></div><div className="md:hidden">{visible.length ? visible.map((document) => <MobileEntityCard key={document.id} title={document.title} identifier={`${document.fileType} · ${document.id}`} leading={<FileText className="size-5 text-primary" />} status={<StatusBadge status="on-track" />} metadata={<><dt className="text-muted-foreground">Client</dt><dd>{document.client}</dd><dt className="text-muted-foreground">Shared with</dt><dd><RecipientSummary document={document} /></dd></>} primaryAction={<Button size="sm" variant="outline" onClick={() => setSelected(document)}>View details</Button>} />) : <EmptyState title="No documents match these filters" description="Clear filters or upload a document." />}</div></CardContent></Card>
    <DocumentDialog document={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} canManage={canManage} onManageAccess={() => setAccessOpen(true)} />
    <DocumentUploadDialog workspace={workspace} clients={clientOptions} fixedCategory={fixedCategory} open={uploadOpen} onOpenChange={setUploadOpen} onCreated={(document) => { setDocuments((current) => [document, ...(current ?? [])]); setUploadOpen(false); toast.success(fixedCategory === "agreement" ? "Agreement sent to client." : "Document saved."); }} />
    {selected ? <AccessDialog workspace={workspace} document={selected} open={accessOpen} onOpenChange={setAccessOpen} onSaved={(document) => { setDocuments((current) => current?.map((item) => item.id === document.id ? document : item) ?? []); setSelected(document); setAccessOpen(false); toast.success("Document access updated."); }} /> : null}
  </div>;
}

function InvoicesWorkspace({ workspace }: { workspace: "admin" | "manager" | "client" }) {
  const [invoices, setInvoices] = useState<SharedInvoice[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SharedInvoice | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const clientsQuery = useQuery({ queryKey: ["tenant-finance-clients", workspace], queryFn: () => listClients({ page: 1, pageSize: 100 }), enabled: workspace === "admin" });
  const clientOptions = workspace === "admin" ? clientsQuery.data?.items.map((client) => ({ id: client.id, name: client.name })) ?? [] : demoClients;
  const refresh = useCallback(async () => { try { setInvoices(await listSharedInvoices(workspace)); setError(false); } catch { setError(true); } }, [workspace]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!invoices && !error) return <LoadingState label="Loading invoices" rows={5} />;
  if (error) return <ErrorState title="Invoices could not load" onRetry={() => void refresh()} />;
  const visible = (invoices ?? []).filter((invoice) => !search || [invoice.invoiceNumber, invoice.client, invoice.uploadedBy].join(" ").toLowerCase().includes(search.toLowerCase()));
  const columns: ColumnDef<SharedInvoice, unknown>[] = [
    { accessorKey: "invoiceNumber", header: "Invoice", cell: ({ row }) => <button className="text-left font-medium hover:text-primary" onClick={() => setSelected(row.original)}>{row.original.invoiceNumber}<span className="mt-1 block text-xs text-muted-foreground">{row.original.fileType} · {row.original.fileName}</span></button> },
    { accessorKey: "client", header: "Client" },
    { id: "amount", header: "Amount", cell: ({ row }) => rupees.format(row.original.amount) },
    { accessorKey: "dueOn", header: "Due date" },
    { accessorKey: "uploadedBy", header: "Uploaded by" },
    { accessorKey: "visibility", header: "Visibility" },
    { id: "status", header: "Payment status", cell: ({ row }) => <StatusBadge status={row.original.status === "paid" ? "complete" : row.original.status === "overdue" ? "at-risk" : "pending"} /> },
  ];
  return <div className="flex flex-col gap-[30px]">
    <PageHeader eyebrow="Finance" title="Invoices" description="Create task invoices, track them, and share them with clients." actions={<Button onClick={() => setUploadOpen(true)}><Upload data-icon="inline-start" />Upload invoice</Button>} />
    <MetricStrip metrics={[{ label: "Total invoices", value: String(invoices?.length ?? 0) }, { label: "Outstanding", value: rupees.format((invoices ?? []).filter((item) => item.status !== "paid").reduce((total, item) => total + item.amount, 0)) }, { label: "Overdue", value: String((invoices ?? []).filter((item) => item.status === "overdue").length) }]} />
    {workspace === "admin" ? <TaskBillingQueue onInvoiceCreated={() => void refresh()} /> : null}
    <FilterToolbar search={{ value: search, onChange: setSearch, label: "Search invoices", placeholder: "Search invoice number, client, reference or uploader" }} />
    <Card><CardContent className="pt-0"><div className="hidden md:block"><DataTable caption="Authorised invoices" columns={columns} data={visible} emptyTitle="No invoices yet" emptyDescription="Upload an invoice to begin managing client finance documents." /></div><div className="md:hidden">{visible.map((invoice) => <MobileEntityCard key={invoice.id} title={invoice.invoiceNumber} identifier={invoice.fileName} leading={<ReceiptText className="size-5 text-primary" />} status={<StatusBadge status={invoice.status === "paid" ? "complete" : "pending"} />} metadata={<><dt className="text-muted-foreground">Client</dt><dd>{invoice.client}</dd><dt className="text-muted-foreground">Amount</dt><dd>{rupees.format(invoice.amount)}</dd></>} primaryAction={<Button size="sm" variant="outline" onClick={() => setSelected(invoice)}>View details</Button>} />)}</div></CardContent></Card>
    <InvoiceDialog invoice={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} onSent={() => void refresh()} />
    <InvoiceUploadDialog workspace={workspace} clients={clientOptions} open={uploadOpen} onOpenChange={setUploadOpen} onCreated={(invoice) => { setInvoices((current) => [invoice, ...(current ?? [])]); setUploadOpen(false); toast.success("Invoice saved."); }} />
  </div>;
}

function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string }> }) { return <section className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-3">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0" />)}</section>; }
function RecipientSummary({ document }: { document: SharedDocument }) { const groups = [["Employee", document.recipientEmployeeIds.length], ["Manager", document.recipientManagerIds.length], ["Client", document.recipientClientIds.length]].filter(([, count]) => Number(count)); return <span className="text-sm text-muted-foreground">{groups.map(([role, count]) => `${role} ${count}`).join(" · ") || "Owner only"}</span>; }

function DocumentDialog({ document, open, onOpenChange, canManage, onManageAccess }: { document: SharedDocument | null; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean; onManageAccess: () => void }) {
  const [tab, setTab] = useState("overview");
  if (!document) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title={document.title} description="Document details and authorised access." className="left-auto right-0 top-0 h-full max-h-none w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none"><div className="pr-8"><p className="text-sm font-medium text-primary">{document.id}</p><h2 className="mt-1 text-xl font-semibold">{document.title}</h2><ResponsiveTabs label="Document details" value={tab} onValueChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "access", label: "Access" }, { value: "activity", label: "Activity" }]}>{tab === "overview" ? <dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="File" value={`${document.fileName} (${document.fileType})`} /><Detail label="Client" value={document.client} /><Detail label="Category" value={document.category} /><Detail label="Updated" value={document.updatedOn} /><Detail label="Related service" value={document.engagement ?? "Not linked"} /><Detail label="Related task" value={document.task ?? "Not linked"} /></dl> : null}{tab === "access" ? <div className="flex flex-col gap-4"><p className="text-sm text-muted-foreground">Owner: {document.uploadedBy}. Tenant Administration oversight: {document.tenantAdminVisible ? "included" : "not required"}.</p><RecipientSummary document={document} />{canManage ? <Button className="w-fit" size="sm" onClick={onManageAccess}>Manage access</Button> : null}</div> : null}{tab === "activity" ? <ul className="flex flex-col divide-y">{document.activity.map((item) => <li key={item.id} className="py-3 first:pt-0"><p className="font-medium text-sm">{item.action}</p><p className="mt-1 text-sm text-muted-foreground">{item.actor} · {item.at}</p></li>)}</ul> : null}</ResponsiveTabs><p className="mt-6 text-sm text-muted-foreground">Preview and download require the private-storage backend. No public file URL is exposed by this frontend mock.</p></div></DialogContent></Dialog>;
}
function InvoiceDialog({ invoice, open, onOpenChange, onSent }: { invoice: SharedInvoice | null; open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) { const [sending, setSending] = useState(false); if (!invoice) return null; const send = async () => { setSending(true); try { await sendTenantInvoice(invoice.id); toast.success("Invoice sent to the client portal."); onSent(); onOpenChange(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Invoice could not be sent."); } finally { setSending(false); } }; return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title={invoice.invoiceNumber} description="Invoice details and authorised visibility."><div className="pr-8"><h2 className="text-xl font-semibold">{invoice.invoiceNumber}</h2><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><Detail label="Client" value={invoice.client} /><Detail label="Amount" value={rupees.format(invoice.amount)} /><Detail label="Due date" value={invoice.dueOn} /><Detail label="Visibility" value={invoice.visibility} /><Detail label="Uploaded by" value={invoice.uploadedBy} /><Detail label="File" value={invoice.fileName} /></dl>{invoice.status === "draft" ? <div className="mt-6 flex justify-end"><Button disabled={sending} onClick={() => void send()}>{sending ? "Sending..." : "Send to client"}</Button></div> : null}</div></DialogContent></Dialog>; }

function TaskBillingQueue({ onInvoiceCreated }: { onInvoiceCreated: () => void }) {
  const queue = useQuery({ queryKey: ["tenant-billable-task-entries"], queryFn: listTenantBillableTaskEntries });
  const [selected, setSelected] = useState<TenantBillableTaskEntry | null>(null);
  if (queue.isPending) return <Card><CardContent className="py-5 text-sm text-muted-foreground">Loading task billing queue...</CardContent></Card>;
  if (queue.isError) return <Card><CardContent className="flex items-center justify-between gap-3 py-5 text-sm text-destructive"><span>Task billing queue could not load.</span><Button size="sm" variant="outline" onClick={() => void queue.refetch()}>Retry</Button></CardContent></Card>;
  return <><Card><CardContent className="py-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Ready to invoice</h2><p className="mt-1 text-sm text-muted-foreground">Task rates are locked when the task is created. Create one invoice per task.</p></div><span className="text-sm text-muted-foreground">{queue.data.length} task{queue.data.length === 1 ? "" : "s"}</span></div>{queue.data.length ? <ul className="mt-4 divide-y border-t">{queue.data.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{entry.taskTitle}</p><p className="mt-1 text-sm text-muted-foreground">{entry.client} · {formatCurrency(entry.grossAmount, entry.currency)}</p></div><Button size="sm" onClick={() => setSelected(entry)}>Create invoice</Button></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">New task charges will appear here.</p>}</CardContent></Card><TaskInvoiceDialog entry={selected} onOpenChange={(open) => !open && setSelected(null)} onCreated={() => { setSelected(null); void queue.refetch(); onInvoiceCreated(); }} /></>;
}

function TaskInvoiceDialog({ entry, onOpenChange, onCreated }: { entry: TenantBillableTaskEntry | null; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [invoiceNumber, setInvoiceNumber] = useState(""); const [dueOn, setDueOn] = useState(""); const [discountType, setDiscountType] = useState<"" | "percentage" | "fixed">(""); const [discountValue, setDiscountValue] = useState(""); const [saving, setSaving] = useState(false);
  if (!entry) return null;
  const discount = discountType === "percentage" ? Math.min(entry.grossAmount, entry.grossAmount * (Number(discountValue || 0) / 100)) : discountType === "fixed" ? Math.min(entry.grossAmount, Number(discountValue || 0)) : 0;
  const submit = async () => { if (!invoiceNumber.trim() || !dueOn) return; setSaving(true); try { await createInvoiceFromTask({ billableTaskEntryId: entry.id, invoiceNumber: invoiceNumber.trim(), issuedOn: new Date().toISOString().slice(0, 10), dueOn, discountType: discountType || undefined, discountValue: Number(discountValue || 0) }); toast.success("Draft invoice created."); onCreated(); } catch (error) { toast.error(error instanceof Error ? error.message : "Invoice could not be created."); } finally { setSaving(false); } };
  return <Dialog open onOpenChange={onOpenChange}><DialogContent title="Create invoice" description="The final amount is calculated on the server."><div className="grid gap-4 pr-8"><p className="font-medium">{entry.taskTitle}</p><p className="text-sm text-muted-foreground">{entry.client} · {formatCurrency(entry.grossAmount, entry.currency)}</p><label className="text-sm font-medium">Invoice number<Input className="mt-1" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label><label className="text-sm font-medium">Due date<Input className="mt-1" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Discount<Select className="mt-1" value={discountType} onChange={(event) => setDiscountType(event.target.value as typeof discountType)}><option value="">No discount</option><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></Select></label><label className="text-sm font-medium">Discount value<Input className="mt-1" type="number" min="0" disabled={!discountType} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} /></label></div><dl className="grid grid-cols-2 gap-3 rounded-[var(--radius-control)] border p-3 text-sm"><div><dt className="text-muted-foreground">Gross amount</dt><dd className="mt-1 font-medium">{formatCurrency(entry.grossAmount, entry.currency)}</dd></div><div><dt className="text-muted-foreground">After discount</dt><dd className="mt-1 font-medium">{formatCurrency(entry.grossAmount - discount, entry.currency)}</dd></div></dl><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving || !invoiceNumber.trim() || !dueOn} onClick={() => void submit()}>{saving ? "Creating..." : "Create draft"}</Button></div></div></DialogContent></Dialog>;
}

function formatCurrency(amount: number, currency: string) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "INR", maximumFractionDigits: 2 }).format(amount); }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }

function FileField({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const fileSize = file ? `${(file.size / 1024 / 1024).toFixed(file.size >= 1024 * 1024 ? 1 : 2)} MB` : null;

  return <label className="group flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-muted/30 px-5 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
    <Input className="sr-only" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt,.zip" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
    <span className="flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"><UploadCloud className="size-5" aria-hidden="true" /></span>
    {file ? <><span className="mt-3 flex items-center gap-1.5 text-sm font-semibold"><FileCheck2 className="size-4 text-success" aria-hidden="true" />{file.name}</span><span className="mt-1 text-xs text-muted-foreground">{fileSize} · Select another file to replace it</span></> : <><span className="mt-3 text-sm font-semibold">Choose a document</span><span className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">PDF, office files, images, text, CSV, or ZIP · maximum 20 MB</span></>}
  </label>;
}

function DocumentUploadDialog({ workspace, clients, fixedCategory, open, onOpenChange, onCreated }: { workspace: "admin" | "manager" | "employee" | "client"; clients: Array<{ id: string; name: string }>; fixedCategory?: (typeof categories)[number]; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (document: SharedDocument) => void }) {
  const [file, setFile] = useState<File | null>(null); const [title, setTitle] = useState(""); const [category, setCategory] = useState<(typeof categories)[number]>(fixedCategory ?? "supporting"); const [clientId, setClientId] = useState(workspace === "client" ? "northstar" : ""); const [employees, setEmployees] = useState<string[]>([]); const [managers, setManagers] = useState<string[]>(workspace === "employee" ? ["mgr-avery"] : []); const [clientRecipients, setClientRecipients] = useState<string[]>([]); const [submitting, setSubmitting] = useState(false);
  const eligibleClients = workspace === "manager" ? clients.slice(0, 2) : clients;
  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const submit = async () => { if (!file || !title || !clientId) return; setSubmitting(true); try { onCreated(await createSharedDocument(workspace, { clientId, title, fileName: file.name, fileType: file.name.split(".").pop()?.toUpperCase() ?? "FILE", sizeBytes: file.size, category: fixedCategory ?? category, recipientEmployeeIds: employees, recipientManagerIds: managers, recipientClientIds: fixedCategory === "agreement" ? [clientId] : clientRecipients })); } catch (error) { toast.error(error instanceof Error ? error.message : "Document could not be prepared."); } finally { setSubmitting(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title="Upload document" description="Choose document metadata and authorised recipients." className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"><div className="pr-8"><h2 className="text-xl font-semibold">Upload document</h2>{workspace === "client" ? <p className="mt-2 text-sm text-muted-foreground">This document will be shared securely with your assigned manager and authorised administration team.</p> : <p className="mt-2 text-sm text-muted-foreground">File bytes are not uploaded by this frontend mock; only validated metadata is retained for portal workflow testing.</p>}<div className="mt-6 grid gap-4 sm:grid-cols-2"><FileField file={file} onFile={setFile} /><label className="flex flex-col gap-1 text-sm font-medium">Document title<Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label><label className="flex flex-col gap-1 text-sm font-medium">Category<Select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</Select></label><label className="flex flex-col gap-1 text-sm font-medium">Related client<Select value={clientId} disabled={workspace === "client"} onChange={(event) => setClientId(event.target.value)}><option value="">Select client</option>{eligibleClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></label></div>{workspace !== "client" ? <fieldset className="mt-6"><legend className="font-semibold">Share with</legend><p className="mt-1 text-sm text-muted-foreground">Select only authorised recipients. Tenant Administration oversight is added where policy requires it.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{workspace !== "employee" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={employees.includes("emp-riley")} onChange={() => toggle("emp-riley", employees, setEmployees)} />Employees</label> : null}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={managers.includes("mgr-avery")} onChange={() => toggle("mgr-avery", managers, setManagers)} />Managers</label>{workspace !== "employee" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clientRecipients.includes(clientId)} disabled={!clientId} onChange={() => toggle(clientId, clientRecipients, setClientRecipients)} />Related client</label> : <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked disabled />Tenant Administration</label>}</div><p className="mt-3 text-sm text-muted-foreground">Access summary: {employees.length} employee, {managers.length} manager, {clientRecipients.length} client recipient{employees.length + managers.length + clientRecipients.length === 1 ? "" : "s"}.</p></fieldset> : null}<div className="mt-7 flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!file || !title || !clientId || submitting} onClick={() => void submit()}>{submitting ? "Preparing…" : "Upload document"}</Button></div></div></DialogContent></Dialog>;
}

function InvoiceUploadDialog({ workspace, clients, open, onOpenChange, onCreated }: { workspace: "admin" | "manager" | "client"; clients: Array<{ id: string; name: string }>; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (invoice: SharedInvoice) => void }) {
  const [file, setFile] = useState<File | null>(null); const [number, setNumber] = useState(""); const [clientId, setClientId] = useState(workspace === "client" ? "northstar" : ""); const [issuedOn, setIssuedOn] = useState("2026-07-23"); const [dueOn, setDueOn] = useState("2026-08-22"); const [amount, setAmount] = useState(""); const [visibility, setVisibility] = useState<"client" | "internal">("client"); const [submitting, setSubmitting] = useState(false); const eligibleClients = workspace === "manager" ? clients.slice(0, 2) : clients;
  const submit = async () => { if (!file || !number || !clientId || !amount) return; setSubmitting(true); try { onCreated(await createSharedInvoice(workspace, { clientId, invoiceNumber: number, issuedOn, dueOn, amount: Number(amount), visibility, fileName: file.name, fileType: file.name.split(".").pop()?.toUpperCase() ?? "FILE", sizeBytes: file.size })); } catch (error) { toast.error(error instanceof Error ? error.message : "Invoice could not be prepared."); } finally { setSubmitting(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title="Upload invoice" description="Choose invoice metadata and authorised visibility." className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"><div className="pr-8"><h2 className="text-xl font-semibold">Upload invoice</h2>{workspace === "client" ? <p className="mt-2 text-sm text-muted-foreground">Your invoice will be shared securely with your assigned manager and authorised administration team.</p> : null}<div className="mt-6 grid gap-4 sm:grid-cols-2"><FileField file={file} onFile={setFile} /><label className="flex flex-col gap-1 text-sm font-medium">Invoice number<Input value={number} onChange={(event) => setNumber(event.target.value)} /></label><label className="flex flex-col gap-1 text-sm font-medium">Related client<Select value={clientId} disabled={workspace === "client"} onChange={(event) => setClientId(event.target.value)}><option value="">Select client</option>{eligibleClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></label><label className="flex flex-col gap-1 text-sm font-medium">Amount (INR)<Input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="flex flex-col gap-1 text-sm font-medium">Invoice date<Input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} /></label><label className="flex flex-col gap-1 text-sm font-medium">Due date<Input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>{workspace !== "client" ? <label className="flex flex-col gap-1 text-sm font-medium">Visibility<Select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="client">Client-visible invoice</option><option value="internal">Internal finance document</option></Select></label> : null}</div><div className="mt-7 flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!file || !number || !clientId || !amount || submitting} onClick={() => void submit()}>{submitting ? "Preparing…" : "Upload invoice"}</Button></div></div></DialogContent></Dialog>;
}

function AccessDialog({ workspace, document, open, onOpenChange, onSaved }: { workspace: "admin" | "manager" | "employee" | "client"; document: SharedDocument; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (document: SharedDocument) => void }) { const [employee, setEmployee] = useState(document.recipientEmployeeIds.includes("emp-riley")); const [manager, setManager] = useState(document.recipientManagerIds.includes("mgr-avery")); const [client, setClient] = useState(document.recipientClientIds.includes(document.clientId)); const save = async () => { if (workspace !== "admin" && workspace !== "manager") return; try { onSaved(await updateSharedDocumentAccess(workspace, document.id, { recipientEmployeeIds: employee ? ["emp-riley"] : [], recipientManagerIds: manager ? ["mgr-avery"] : [], recipientClientIds: client ? [document.clientId] : [] })); } catch (error) { toast.error(error instanceof Error ? error.message : "Access could not be updated."); } }; return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title="Manage document access" description="Update authorised document recipients."><div className="pr-8"><h2 className="text-xl font-semibold">Manage access</h2><p className="mt-2 text-sm text-muted-foreground">Owner access and Tenant Administration oversight remain protected in this frontend mock.</p><div className="mt-5 flex flex-col gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={employee} onChange={(event) => setEmployee(event.target.checked)} />Share with employee</label><label className="flex items-center gap-2"><input type="checkbox" checked={manager} onChange={(event) => setManager(event.target.checked)} />Share with assigned manager</label><label className="flex items-center gap-2"><input type="checkbox" checked={client} onChange={(event) => setClient(event.target.checked)} />Share with related client</label></div><div className="mt-7 flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void save()}>Save access</Button></div></div></DialogContent></Dialog>; }

function LegacyFinanceSection({ section, workspace }: { section: "payments" | "agreements"; workspace: Extract<Workspace, "admin" | "manager" | "employee" | "client"> }) {
  const query = useQuery({ queryKey: ["finance-documents-legacy", workspace], queryFn: () => getOperationalWorkspace(workspace) });
  if (query.isPending) return <LoadingState label={`Loading ${section}`} rows={4} />;
  if (query.isError) return <ErrorState title={`${section} could not load`} onRetry={() => void query.refetch()} />;
  const items = section === "payments"
    ? query.data.payments.map((payment) => ({ id: payment.id, title: payment.client, detail: `${rupees.format(payment.amount)} · ${payment.method.replaceAll("-", " ")} · ${payment.receivedOn}`, status: payment.status }))
    : query.data.documents.filter((document) => document.category === "agreement").map((document) => ({ id: document.id, title: document.name, detail: `${document.client} · ${document.updatedOn}`, status: "active" }));
  const title = section === "payments" ? "Payments" : "Agreements";
  return <div className="flex flex-col gap-[30px]"><PageHeader eyebrow={section === "payments" ? "Finance" : "Operations"} title={title} description={section === "payments" ? "Recorded payment status for authorised client invoices." : "Authorised service agreements and related records."} /><Card><CardContent className="pt-6">{items.length ? <ul className="flex flex-col divide-y">{items.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 py-4 first:pt-0"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div><StatusBadge status={item.status === "paid" || item.status === "received" || item.status === "active" ? "complete" : item.status === "overdue" || item.status === "reversed" ? "at-risk" : "pending"} /></li>)}</ul> : <EmptyState title={`No ${title.toLowerCase()}`} description="Authorised records will appear here." />}</CardContent></Card></div>;
}
