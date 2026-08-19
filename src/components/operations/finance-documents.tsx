"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, FileCheck2, FileText, FileWarning, Hourglass, ReceiptText, Upload, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  createSharedDocument,
  createSharedInvoice,
  getPrivateDocumentDownloadUrl,
  createInvoiceFromEntries,
  listEmployeeDocumentOptions,
  listTenantBillingGroups,
  listTenantAdminTaskOptions,
  listSharedDocuments,
  listSharedInvoices,
  sendTenantInvoice,
  type EmployeeDocumentOptions,
  type TenantBillingGroup,
  type TenantAdminTaskOptions,
} from "@/features/operations/api/operations-api";
import { listClients } from "@/features/administration/api/administration-api";
import { createInvoicePdfUrl, downloadInvoicePdf } from "@/lib/invoice-pdf";
import { openSignedDownloadUrl } from "@/lib/signed-download";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { SearchableFilterSelect } from "@/components/shared/searchable-filter-select";
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
import { DatePicker } from "@/components/shared/date-picker";
import { Select } from "@/components/ui/select";
import type { Workspace } from "@/types/domain";
import type { SharedDocument, SharedInvoice } from "@/types/operations";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const categories = ["agreement", "deliverable", "evidence", "compliance", "finance", "report", "client-upload", "employee-submission", "internal", "supporting", "other"] as const;

export function FinanceDocuments({
  section,
  workspace = "admin",
}: {
  section: "invoices" | "agreements" | "documents";
  workspace?: Extract<Workspace, "admin" | "employee" | "client">;
}) {
  if (section === "documents" || section === "agreements") {
    return (
      <DocumentsWorkspace
        workspace={workspace as Extract<Workspace, "admin" | "employee">}
        fixedCategory={section === "agreements" ? "agreement" : undefined}
      />
    );
  }

  return <InvoicesWorkspace workspace={workspace as "admin" | "client"} />;
}

function DocumentsWorkspace({ workspace, fixedCategory }: { workspace: Extract<Workspace, "admin" | "employee">; fixedCategory?: (typeof categories)[number] }) {
  const [documents, setDocuments] = useState<SharedDocument[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [selected, setSelected] = useState<SharedDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const clientsQuery = useQuery({ queryKey: ["tenant-finance-clients", workspace], queryFn: () => listClients({ page: 1, pageSize: 100 }), enabled: workspace === "admin" });
  const employeeOptionsQuery = useQuery({ queryKey: ["employee-document-options"], queryFn: listEmployeeDocumentOptions, enabled: workspace === "employee" });
  const adminTaskOptionsQuery = useQuery({ queryKey: ["tenant-document-task-options"], queryFn: listTenantAdminTaskOptions, enabled: workspace === "admin" });
  const clientOptions = workspace === "admin"
    ? clientsQuery.data?.items.map((client) => ({ id: client.id, name: client.name })) ?? []
    : employeeOptionsQuery.data?.clients ?? [];
  const refresh = useCallback(async () => {
    try { setDocuments(await listSharedDocuments(workspace)); setError(false); } catch { setError(true); }
  }, [workspace]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!documents && !error) return <LoadingState label="Loading documents" rows={5} />;
  if (error) return <ErrorState title="Documents could not load" onRetry={() => void refresh()} />;
  const agreementDocuments = (documents ?? []).filter((document) => document.category === "agreement");
  const visible = (documents ?? []).filter((document) =>
    document.category !== "invoice" &&
    (!search || [document.title, document.fileName, document.client, document.category, document.uploadedBy].join(" ").toLowerCase().includes(search.toLowerCase())) &&
    (fixedCategory ? document.category === fixedCategory : !category || document.category === category) &&
    (!clientFilter || document.clientId === clientFilter) &&
    (!decisionFilter ||
      (decisionFilter === "expired"
        ? document.agreementAccessStatus === "expired"
        : document.clientDecisionStatus === decisionFilter && document.agreementAccessStatus !== "expired")),
  );
  const downloadDocument = async (documentId: string) => {
    try {
      await openSignedDownloadUrl(() => getPrivateDocumentDownloadUrl(workspace, documentId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document download could not be started.");
    }
  };
  const columns: ColumnDef<SharedDocument, unknown>[] = [
    { accessorKey: "title", header: "Document", cell: ({ row }) => <button className="text-left font-medium hover:text-primary" onClick={() => setSelected(row.original)}>{row.original.title}<span className="mt-1 block text-xs text-muted-foreground">{row.original.fileType} · {row.original.id}</span></button> },
    { accessorKey: "category", header: "Category" },
    { accessorKey: "client", header: "Client" },
      { accessorKey: "uploadedBy", header: "Uploaded by" },
      { id: "clientDecision", header: fixedCategory === "agreement" ? "Status" : "Client decision", cell: ({ row }) => <AgreementDecisionStatus document={row.original} /> },
      { id: "shared", header: "Shared with", cell: ({ row }) => <RecipientSummary document={row.original} /> },
    { accessorKey: "updatedOn", header: "Updated" },
    { id: "actions", header: "Actions", cell: ({ row }) => <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(row.original)}>View details</Button><Button size="sm" variant="outline" onClick={() => void downloadDocument(row.original.id)}><Download data-icon="inline-start" />Download</Button></div> },
  ];
  const canUpload = workspace === "admin" || workspace === "employee";
  return <div className="flex flex-col gap-[30px]">
    <PageHeader eyebrow="Operations" title={fixedCategory === "agreement" ? "Agreements" : "Documents"} description={fixedCategory === "agreement" ? "Upload agreements and send them to the selected client." : "Upload a document and send it to a client, an employee, or both."} actions={canUpload ? <Button onClick={() => setUploadOpen(true)}><Upload data-icon="inline-start" />{fixedCategory === "agreement" ? "Upload agreement" : "Upload document"}</Button> : undefined} />
    {fixedCategory === "agreement" ? (
      <AgreementMetricGrid documents={agreementDocuments} />
    ) : (
      <MetricStrip metrics={[{ label: "All documents", value: String(documents?.length ?? 0) }, { label: "Shared with me", value: String(documents?.filter((item) => item.uploadedByRole !== workspace).length ?? 0) }, { label: "Client documents", value: String(documents?.filter((item) => item.recipientClientIds.length).length ?? 0) }]} />
    )}
    <FilterToolbar
      search={{ value: search, onChange: setSearch, label: "Search documents", placeholder: fixedCategory === "agreement" ? "Search agreement, client, or uploader" : "Search document name, client, category or uploader" }}
      filterGridClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      activeFilterCount={Number(Boolean(category)) + Number(Boolean(clientFilter)) + Number(Boolean(decisionFilter))}
      onClear={() => {
        setCategory("");
        setClientFilter("");
        setDecisionFilter("");
      }}
    >
      {!fixedCategory ? <label className="flex flex-col gap-1 text-sm font-medium">Category<Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</Select></label> : null}
      {fixedCategory === "agreement" && workspace === "admin" ? (
        <>
          <SearchableFilterSelect
            label="Client"
            ariaLabel="Filter agreements by client"
            value={clientFilter}
            onChange={setClientFilter}
            options={clientOptions}
            emptyLabel="All clients"
            placeholder="Search clients..."
          />
          <label className="flex flex-col gap-1 text-sm font-medium">
            Client decision
            <Select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)}>
              <option value="">All decisions</option>
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </Select>
          </label>
        </>
      ) : null}
    </FilterToolbar>
    <Card><CardContent className="pt-0"><div className="hidden md:block"><DataTable caption="Authorised documents" columns={columns} data={visible} emptyTitle={search || category ? "No documents match these filters" : "No documents yet"} emptyDescription="Upload the first document to securely share files with authorised users." /></div>    <div className="md:hidden">{visible.length ? visible.map((document) => <MobileEntityCard key={document.id} title={document.title} identifier={`${document.fileType} · ${document.id}`} leading={<FileText className="size-5 text-primary" />} status={<StatusBadge status="on-track" />} metadata={<><dt className="text-muted-foreground">Client</dt><dd>{document.client}</dd><dt className="text-muted-foreground">Shared with</dt><dd><RecipientSummary document={document} /></dd></>} primaryAction={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(document)}>View details</Button><Button size="sm" variant="outline" onClick={() => void downloadDocument(document.id)}><Download data-icon="inline-start" />Download</Button></div>} />) : <EmptyState title="No documents match these filters" description="Clear filters or upload a document." />}</div></CardContent></Card>
    <DocumentDialog document={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} onDownload={() => selected ? void downloadDocument(selected.id) : undefined} />
    {workspace === "employee"
      ? <EmployeeDocumentUploadDialog clients={clientOptions} options={employeeOptionsQuery.data} fixedCategory={fixedCategory} open={uploadOpen} onOpenChange={setUploadOpen} onCreated={(document) => { setDocuments((current) => [document, ...(current ?? [])]); setUploadOpen(false); toast.success("Document shared."); }} />
      : <DocumentUploadDialog workspace={workspace} clients={clientOptions} adminOptions={adminTaskOptionsQuery.data} fixedCategory={fixedCategory} open={uploadOpen} onOpenChange={setUploadOpen} onCreated={(document) => { setDocuments((current) => [document, ...(current ?? [])]); setUploadOpen(false); toast.success(fixedCategory === "agreement" ? "Agreement sent to client." : "Document saved."); }} />}
  </div>;
}

function InvoicesWorkspace({ workspace }: { workspace: "admin" | "client" }) {
  const [invoices, setInvoices] = useState<SharedInvoice[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SharedInvoice | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const clientsQuery = useQuery({ queryKey: ["tenant-finance-clients", workspace], queryFn: () => listClients({ page: 1, pageSize: 100 }), enabled: workspace === "admin" });
  const clientOptions = workspace === "admin" ? clientsQuery.data?.items.map((client) => ({ id: client.id, name: client.name })) ?? [] : [];
  const refresh = useCallback(async () => { try { setInvoices(await listSharedInvoices(workspace)); setError(false); } catch { setError(true); } }, [workspace]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!invoices && !error) return <LoadingState label="Loading invoices" rows={5} />;
  if (error) return <ErrorState title="Invoices could not load" onRetry={() => void refresh()} />;
  const visible = (invoices ?? []).filter((invoice) => !search || [invoice.invoiceNumber, invoice.client, invoice.taskTitle, invoice.uploadedBy].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()));
  const columns: ColumnDef<SharedInvoice, unknown>[] = [
    { accessorKey: "invoiceNumber", header: "Invoice", cell: ({ row }) => <button className="text-left font-medium hover:text-primary" onClick={() => setSelected(row.original)}>{row.original.invoiceNumber}<span className="mt-1 block text-xs text-muted-foreground">{row.original.fileType} · {row.original.fileName}</span></button> },
    { accessorKey: "client", header: "Client", cell: ({ row }) => <div><p className="font-medium">{row.original.client}</p><InvoiceSummary invoice={row.original} /></div> },
    { id: "amount", header: "Amount", cell: ({ row }) => rupees.format(row.original.amount) },
    { accessorKey: "dueOn", header: "Due date" },
    { accessorKey: "uploadedBy", header: "Uploaded by" },
    { accessorKey: "visibility", header: "Visibility" },
    { id: "status", header: "Invoice status", cell: ({ row }) => row.original.status === "draft" ? <Button size="sm" onClick={() => setSelected(row.original)}>Review and send</Button> : <div className="flex items-center gap-2"><StatusBadge status={row.original.status === "paid" ? "complete" : row.original.status === "overdue" ? "at-risk" : "on-track"} /><Button size="sm" variant="outline" onClick={() => downloadInvoicePdf(row.original)}><Download data-icon="inline-start" />Download</Button></div> },
  ];
  return <div className="flex flex-col gap-[30px]">
    <PageHeader eyebrow="Finance" title="Invoices" description="Create, review and share invoices with clients." actions={workspace === "admin" ? <Button onClick={() => setUploadOpen(true)}><Upload data-icon="inline-start" />Upload invoice</Button> : undefined} />
    <MetricStrip metrics={[{ label: "Total invoices", value: String(invoices?.length ?? 0) }, { label: "Outstanding", value: rupees.format((invoices ?? []).filter((item) => item.status !== "paid").reduce((total, item) => total + item.amount, 0)) }, { label: "Overdue", value: String((invoices ?? []).filter((item) => item.status === "overdue").length) }]} />
    {workspace === "admin" ? <BillingQueue onInvoiceCreated={(invoice) => { setInvoices((current) => [invoice, ...(current ?? [])]); setSelected(invoice); void refresh(); }} /> : null}
    <FilterToolbar search={{ value: search, onChange: setSearch, label: "Search invoices", placeholder: "Search invoice number, client, task or uploader" }} />
    <Card><CardContent className="pt-0"><div className="hidden md:block"><DataTable caption="Authorised invoices" columns={columns} data={visible} emptyTitle="No invoices yet" emptyDescription="Upload an invoice to begin managing client finance documents." /></div><div className="md:hidden">{visible.map((invoice) => <MobileEntityCard key={invoice.id} title={invoice.invoiceNumber} identifier={invoice.fileName} leading={<ReceiptText className="size-5 text-primary" />} status={<StatusBadge status={invoice.status === "paid" ? "complete" : "pending"} />} metadata={<><dt className="text-muted-foreground">Client</dt><dd>{invoice.client}<InvoiceSummary invoice={invoice} /></dd><dt className="text-muted-foreground">Amount</dt><dd>{rupees.format(invoice.amount)}</dd></>} primaryAction={<Button size="sm" variant="outline" onClick={() => setSelected(invoice)}>View details</Button>} />)}</div></CardContent></Card>
    <InvoiceDialog invoice={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} onSent={() => void refresh()} />
    {workspace === "admin" ? <InvoiceUploadDialog workspace={workspace} clients={clientOptions} open={uploadOpen} onOpenChange={setUploadOpen} onCreated={(invoice) => { setInvoices((current) => [invoice, ...(current ?? [])]); setUploadOpen(false); toast.success("Invoice saved."); }} /> : null}
  </div>;
}

function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string }> }) { return <section className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-3">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0" />)}</section>; }

function AgreementMetricGrid({ documents }: { documents: readonly SharedDocument[] }) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const dueSoon = documents.filter(
    (document) => document.clientDecisionStatus === "pending" && document.recipientClientIds.length > 0,
  ).length;
  const expiringSoon = documents.filter((document) => {
    if (document.agreementAccessStatus === "expired") return false;
    if (!document.validUntil) return false;
    const expiry = new Date(document.validUntil).getTime();
    return expiry >= now && expiry <= now + thirtyDaysMs;
  }).length;
  const expired = documents.filter((document) => document.agreementAccessStatus === "expired").length;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        variant="elevated"
        icon={FileText}
        metric={{ label: "Total agreements", value: String(documents.length) }}
        className="shadow-sm"
      />
      <MetricCard
        variant="elevated"
        icon={Hourglass}
        metric={{ label: "Due soon", value: String(dueSoon), change: "Awaiting client review" }}
        className="shadow-sm"
      />
      <MetricCard
        variant="elevated"
        icon={FileWarning}
        metric={{ label: "Expiring soon", value: String(expiringSoon), change: "Within 30 days" }}
        className="shadow-sm"
      />
      <MetricCard
        variant="elevated"
        icon={FileCheck2}
        metric={{
          label: "Expired",
          value: String(expired),
          change: "Past expiry date",
        }}
        className="shadow-sm"
      />
    </section>
  );
}
function AgreementDecisionStatus({ document }: { document: SharedDocument }) {
  if (document.category === "agreement" && document.agreementAccessStatus === "expired") {
    return (
      <div className="flex flex-col gap-1">
        <Badge tone="danger">Expired</Badge>
        <span className="text-xs text-muted-foreground">{document.client}</span>
      </div>
    );
  }

  return (
    <StatusBadge
      status={
        document.clientDecisionStatus === "approved"
          ? "complete"
          : document.clientDecisionStatus === "rejected"
            ? "at-risk"
            : "pending"
      }
    />
  );
}
function RecipientSummary({ document }: { document: SharedDocument }) {
  if (document.category === "agreement" && document.recipientClientIds.length > 0) {
    const clientId = document.clientId || document.recipientClientIds[0] || "";
    return (
      <span className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{document.client}</span>
        {clientId ? <span className="mt-0.5 block font-mono text-xs">{clientId}</span> : null}
      </span>
    );
  }

  const groups = [["Tenant Admin", document.recipientTenantAdminIds.length], ["Employee", document.recipientEmployeeIds.length], ["Manager", document.recipientManagerIds.length], ["Client", document.recipientClientIds.length]].filter(([, count]) => Number(count));
  return <span className="text-sm text-muted-foreground">{groups.map(([role, count]) => `${role} ${count}`).join(" · ") || "Owner only"}</span>;
}
function InvoiceSummary({ invoice }: { invoice: SharedInvoice }) {
  if (invoice.serviceName) {
    const count = invoice.itemCount || invoice.items.length;
    return (
      <span className="mt-1 block text-xs text-muted-foreground">
        {invoice.serviceName}
        {count > 0 ? ` · ${count} item${count === 1 ? "" : "s"}` : ""}
      </span>
    );
  }
  if (!invoice.taskTitle) return null;
  return <span className="invoice-task-name mt-1 block text-xs text-muted-foreground">Task: {invoice.taskTitle}</span>;
}

function DocumentDialog({
  document,
  open,
  onOpenChange,
  onDownload,
}: {
  document: SharedDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
}) {
  const [tab, setTab] = useState("overview");
  if (!document) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={document.title}
        description="Document details and authorised access."
        className="left-auto right-0 top-0 h-full max-h-none w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none"
      >
        <div className="pr-8">
          <p className="text-sm font-medium text-primary">{document.id}</p>
          <h2 className="mt-1 text-xl font-semibold">{document.title}</h2>
          <ResponsiveTabs
            label="Document details"
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: "overview", label: "Overview" },
              { value: "access", label: "Access" },
              { value: "activity", label: "Activity" },
            ]}
          >
            {tab === "overview" ? (
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Detail label="File" value={`${document.fileName} (${document.fileType})`} />
                <Detail label="Client" value={document.client} />
                <Detail label="Category" value={document.category} />
                <Detail label="Sent by" value={document.uploadedBy} />
                <Detail label="Sent at" value={document.updatedOn} />
                <Detail label="Expires on" value={document.validUntil ? new Date(document.validUntil).toLocaleString() : "Not set"} />
                <Detail label="Why sent" value={document.shareReason ?? "Not specified"} />
                <Detail label="Related service" value={document.engagement ?? "Not linked"} />
                <Detail label="Related task" value={document.task ?? "Not linked"} />
              </dl>
            ) : null}
            {tab === "access" ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Owner: {document.uploadedBy}. Tenant Administration oversight:{" "}
                  {document.tenantAdminVisible ? "included" : "not required"}.
                </p>
                <RecipientSummary document={document} />
              </div>
            ) : null}
            {tab === "activity" ? (
              <ul className="flex flex-col divide-y">
                {document.activity.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.actor} · {item.at}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </ResponsiveTabs>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={onDownload}>
              <Download data-icon="inline-start" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function InvoiceDialog({ invoice, open, onOpenChange, onSent }: { invoice: SharedInvoice | null; open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) {
  const [sending, setSending] = useState(false);
  if (!invoice) return null;
  const send = async () => {
    setSending(true);
    try {
      await sendTenantInvoice(invoice.id);
      toast.success("Invoice sent to the client portal.");
      onSent();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invoice could not be sent.");
    } finally {
      setSending(false);
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title={invoice.invoiceNumber} description="Review the invoice PDF before sending it to the client." className="max-w-3xl"><div className="grid gap-5 pr-8"><dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="Client" value={invoice.client} />{invoice.serviceName ? <Detail label="Service" value={`${invoice.serviceName}${invoice.itemCount ? ` · ${invoice.itemCount} items` : ""}`} /> : invoice.taskTitle ? <Detail label="Task" value={invoice.taskTitle} /> : null}<Detail label="Amount" value={rupees.format(invoice.amount)} /><Detail label="Invoice date" value={invoice.issuedOn} /><Detail label="Payment due" value={invoice.dueOn} /><Detail label="Uploaded by" value={invoice.uploadedBy} /></dl>{invoice.items.length > 1 ? <ul className="grid gap-2 text-sm">{invoice.items.map((item) => <li key={item.description} className="flex justify-between gap-3"><span>{item.description}</span><span className="font-medium">{formatCurrency(item.netAmount, invoice.currency)}</span></li>)}</ul> : null}<InvoicePdfPreview invoice={invoice} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => downloadInvoicePdf(invoice)}><Download data-icon="inline-start" />Download PDF</Button>{invoice.status === "draft" ? <Button disabled={sending} onClick={() => void send()}>{sending ? "Sending..." : "Send to client"}</Button> : null}</div></div></DialogContent></Dialog>;
}

function InvoicePdfPreview({ invoice }: { invoice: SharedInvoice }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const previewUrl = createInvoicePdfUrl(invoice);
    setUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [invoice]);
  return <div className="overflow-hidden rounded-[var(--radius-control)] border bg-muted/20"><div className="border-b px-3 py-2 text-sm font-medium">PDF preview</div>{url ? <iframe title={`Invoice ${invoice.invoiceNumber} PDF preview`} src={url} className="h-96 w-full bg-white" /> : <div className="grid h-96 place-items-center text-sm text-muted-foreground">Preparing PDF preview...</div>}</div>;
}

function BillingQueue({ onInvoiceCreated }: { onInvoiceCreated: (invoice: SharedInvoice) => void }) {
  const queue = useQuery({ queryKey: ["tenant-billing-groups"], queryFn: listTenantBillingGroups });
  const [tab, setTab] = useState<"ready" | "waiting">("ready");
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selected, setSelected] = useState<TenantBillingGroup | null>(null);
  if (queue.isPending) return <Card><CardContent className="py-5 text-sm text-muted-foreground">Loading billing groups...</CardContent></Card>;
  if (queue.isError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-5 text-sm text-destructive">
          <span>Billing groups could not load.</span>
          <Button size="sm" variant="outline" onClick={() => void queue.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }
  const groups = queue.data ?? [];
  const readyGroups = groups.filter((group) => group.status === "ready");
  const waitingGroups = groups.filter((group) => group.status === "waiting");
  const clients = [...new Map(groups.map((group) => [group.clientId, { id: group.clientId, name: group.clientName }])).values()];
  const periods = [...new Map(groups.map((group) => [group.billingPeriodKey, group.billingPeriodLabel])).entries()];
  const filtered = (tab === "ready" ? readyGroups : waitingGroups).filter((group) => {
    const haystack = [group.clientName, group.serviceName, group.billingLabel, ...group.charges.map((charge) => charge.taskTitle)].join(" ").toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) &&
      (!selectedClientId || group.clientId === selectedClientId) &&
      (!selectedPeriod || group.billingPeriodKey === selectedPeriod);
  });
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Ready to bill</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved charges wait in a billing group until every compatible charge is ready. Invoices are created only after you review the group.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">{groups.length} group{groups.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-4">
          <ResponsiveTabs
            label="Billing group status"
            value={tab}
            onValueChange={(value) => setTab(value === "waiting" ? "waiting" : "ready")}
            tabs={[
              { value: "ready", label: `Ready ${readyGroups.length}` },
              { value: "waiting", label: `Waiting ${waitingGroups.length}` },
            ]}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Search billing
            <Input className="mt-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search billing..." />
          </label>
          <label className="text-sm font-medium">
            Client
            <Select className="mt-1" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="">All clients</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </Select>
          </label>
          <label className="text-sm font-medium">
            Period
            <Select className="mt-1" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
              <option value="">All periods</option>
              {periods.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </label>
        </div>
        {filtered.length ? (
          <ul className="mt-4 grid gap-3">
            {filtered.map((group) => (
              <li key={group.id}>
                <BillingGroupCard group={group} onSelect={() => setSelected(group)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {tab === "ready" ? "No complete billing groups are ready yet." : "No billing groups are waiting on remaining charges."}
          </p>
        )}
      </CardContent>
      <BillingGroupDrawer
        group={selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        onCreated={(invoice) => {
          setSelected(null);
          void queue.refetch();
          onInvoiceCreated(invoice);
        }}
      />
    </Card>
  );
}

function BillingGroupCard({ group, onSelect }: { group: TenantBillingGroup; onSelect: () => void }) {
  const readyNames = group.charges.filter((charge) => charge.status === "ready").map((charge) => charge.taskTitle);
  return (
    <div className="rounded-[var(--radius-card)] border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{group.clientName}</p>
          <p className="mt-1 text-sm">{group.serviceName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Badge tone="info">{group.billingFrequency === "annually" ? "Annual" : group.billingFrequency === "one_time" ? "One-time" : group.billingFrequency === "quarterly" ? "Quarterly" : "Monthly"}</Badge>
            <span className="ml-2">{group.billingPeriodLabel}</span>
          </p>
        </div>
        <Badge tone={group.status === "ready" ? "success" : "warning"}>{group.status === "ready" ? "Ready" : "Waiting"}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{group.readyCount} / {group.expectedCount} charges ready</span>
        <span className="font-medium">{formatCurrency(group.status === "ready" ? group.readyAmount : group.expectedAmount, group.currency)}</span>
      </div>
      {group.status === "ready" ? (
        <p className="mt-2 text-sm text-muted-foreground">{readyNames.join(" · ")}</p>
      ) : (
        <ul className="mt-3 grid gap-2 text-sm">
          {group.charges.map((charge) => (
            <li key={charge.id} className="flex flex-wrap items-start justify-between gap-2">
              <span>
                {charge.status === "ready" ? "✓" : "○"} {charge.taskTitle}
                {charge.status === "awaiting" ? <span className="mt-0.5 block text-xs text-muted-foreground">Awaiting completion / approval</span> : null}
              </span>
              <span className="font-medium">{formatCurrency(charge.grossAmount, charge.currency)}</span>
            </li>
          ))}
        </ul>
      )}
      {group.status === "waiting" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {formatCurrency(group.readyAmount, group.currency)} ready · {formatCurrency(group.expectedAmount, group.currency)} expected
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant={group.status === "ready" ? "default" : "outline"} onClick={onSelect}>
          {group.status === "ready" ? "Review & create" : "View details"}
        </Button>
      </div>
    </div>
  );
}

function BillingGroupDrawer({
  group,
  onOpenChange,
  onCreated,
}: {
  group: TenantBillingGroup | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (invoice: SharedInvoice) => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [discountType, setDiscountType] = useState<"" | "percentage" | "fixed">("");
  const [discountValue, setDiscountValue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setInvoiceNumber("");
    setIssuedOn(new Date().toISOString().slice(0, 10));
    setDueOn("");
    setDiscountType("");
    setDiscountValue("");
  }, [group?.id]);
  if (!group) return null;
  const canCreate = group.status === "ready";
  const subtotal = group.readyAmount;
  const discount = discountType === "percentage"
    ? Math.min(subtotal, subtotal * (Number(discountValue || 0) / 100))
    : discountType === "fixed"
      ? Math.min(subtotal, Number(discountValue || 0))
      : 0;
  const submit = async () => {
    if (!canCreate || !invoiceNumber.trim() || !issuedOn || !dueOn) return;
    setSaving(true);
    try {
      const invoice = await createInvoiceFromEntries({
        billableTaskEntryIds: group.charges.filter((charge) => charge.status === "ready").map((charge) => charge.id),
        invoiceNumber: invoiceNumber.trim(),
        issuedOn,
        dueOn,
        discountType: discountType || undefined,
        discountValue: Number(discountValue || 0),
      });
      toast.success("Invoice generated. Review and send it to the client.");
      onCreated(invoice);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invoice could not be created.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={canCreate ? "Create invoice" : "Billing group"}
        description={`${group.clientName} · ${group.serviceName}`}
        className="left-auto right-0 top-0 h-full max-h-none w-full max-w-md translate-x-0 translate-y-0 overflow-y-auto rounded-none"
      >
        <div className="grid gap-4 pr-8">
          <div>
            <p className="font-medium">{group.clientName}</p>
            <p className="mt-1 text-sm">{group.serviceName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{group.billingLabel}</p>
            <p className="mt-2 text-sm">{group.readyCount} / {group.expectedCount} charges ready</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice items</p>
            <ul className="mt-2 divide-y border-t">
              {group.charges.map((charge) => (
                <li key={charge.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{charge.taskTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {charge.status === "ready" ? `Task due: ${formatTaskDue(charge.taskDueOn)}` : "Awaiting completion / approval"}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(charge.grossAmount, charge.currency)}</p>
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium">{formatCurrency(subtotal, group.currency)}</dd></div>
            {canCreate && discount > 0 ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Discount</dt><dd className="font-medium">{formatCurrency(discount, group.currency)}</dd></div> : null}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total</dt><dd className="font-medium">{formatCurrency(subtotal - discount, group.currency)}</dd></div>
          </dl>
          {canCreate ? (
            <>
              <label className="text-sm font-medium">
                Discount
                <Select className="mt-1" value={discountType} onChange={(event) => setDiscountType(event.target.value as typeof discountType)}>
                  <option value="">No discount</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </label>
              <label className="text-sm font-medium">
                Discount value
                <Input className="mt-1" type="number" min="0" max={discountType === "percentage" ? "100" : undefined} disabled={!discountType} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
              </label>
              <label className="text-sm font-medium">
                Invoice number
                <Input className="mt-1" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="INV/26-27/0042" />
              </label>
              <label className="text-sm font-medium">
                Invoice date
                <DatePicker className="mt-1" value={issuedOn} onChange={setIssuedOn} aria-label="Invoice date" />
              </label>
              <label className="text-sm font-medium">
                Payment due
                <DatePicker className="mt-1" value={dueOn} onChange={setDueOn} aria-label="Payment due" />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button disabled={saving || !invoiceNumber.trim() || !issuedOn || !dueOn} onClick={() => void submit()}>
                  {saving ? "Generating..." : "Generate draft"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatTaskDue(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function formatCurrency(amount: number, currency: string) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "INR", maximumFractionDigits: 2 }).format(amount); }
function combineLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "23:59"}:00`).toISOString();
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }

function FileField({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const fileSize = file ? `${(file.size / 1024 / 1024).toFixed(file.size >= 1024 * 1024 ? 1 : 2)} MB` : null;

  return (
    <label className="group flex min-h-40 w-full min-w-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-border bg-muted/30 px-5 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
      <Input className="sr-only" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt,.zip" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"><UploadCloud className="size-5" aria-hidden="true" /></span>
      {file ? (
        <>
          <span className="mt-3 flex w-full min-w-0 items-start justify-center gap-1.5 text-sm font-semibold">
            <FileCheck2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <span className="min-w-0 break-all">{file.name}</span>
          </span>
          <span className="mt-1 w-full min-w-0 text-xs text-muted-foreground">{fileSize} · Select another file to replace it</span>
        </>
      ) : (
        <>
          <span className="mt-3 text-sm font-semibold">Choose a document</span>
          <span className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">PDF, office files, images, text, CSV, or ZIP · maximum 20 MB</span>
        </>
      )}
    </label>
  );
}

function EmployeeDocumentUploadDialog({ clients, options, fixedCategory, open, onOpenChange, onCreated }: { clients: Array<{ id: string; name: string }>; options?: EmployeeDocumentOptions; fixedCategory?: (typeof categories)[number]; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (document: SharedDocument) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>(fixedCategory ?? "supporting");
  const [clientId, setClientId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [tenantAdminId, setTenantAdminId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId && clients[0]) setClientId(clients[0].id);
  }, [clientId, clients]);

  const submit = async () => {
    if (!file || !title.trim() || !clientId || (!tenantAdminId && !managerId)) return;
    setSubmitting(true);
    try {
      onCreated(await createSharedDocument("employee", {
        clientId,
        taskId: taskId || undefined,
        file,
        title: title.trim(),
        fileName: file.name,
        fileType: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
        sizeBytes: file.size,
        category: fixedCategory ?? category,
        recipientTenantAdminIds: tenantAdminId ? [tenantAdminId] : [],
        recipientManagerIds: managerId ? [managerId] : [],
        recipientEmployeeIds: [],
        recipientClientIds: [],
      }));
      setFile(null);
      setTitle("");
      setTenantAdminId("");
      setManagerId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document could not be uploaded.");
    } finally {
      setSubmitting(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title="Upload document" description="Select the authorised recipients for this document." className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"><div className="pr-8"><h2 className="text-xl font-semibold">Upload document</h2><p className="mt-2 text-sm text-muted-foreground">The document will be visible only to you and the selected Tenant Admin or Manager.</p><div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2"><FileField file={file} onFile={setFile} /><label className="flex flex-col gap-1 text-sm font-medium">Document title<Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label><label className="flex flex-col gap-1 text-sm font-medium">Category<Select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</Select></label><label className="flex flex-col gap-1 text-sm font-medium">Related client<Select value={clientId} onChange={(event) => { setClientId(event.target.value); setTaskId(""); }}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></label><label className="flex flex-col gap-1 text-sm font-medium">Related task (optional)<Select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">No task link</option>{options?.tasks.filter((task) => task.clientId === clientId).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</Select></label><label className="flex flex-col gap-1 text-sm font-medium">Send to Tenant Admin<Select value={tenantAdminId} onChange={(event) => setTenantAdminId(event.target.value)}><option value="">Select Tenant Admin</option>{options?.tenantAdmins.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}</Select></label><label className="flex flex-col gap-1 text-sm font-medium">Send to Manager<Select value={managerId} onChange={(event) => setManagerId(event.target.value)}><option value="">Select Manager</option>{options?.managers.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}</Select></label></div>{!clients.length ? <p className="mt-4 text-sm text-muted-foreground">Assigned task clients will appear here when tasks are assigned to you.</p> : null}<div className="mt-7 flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!file || !title.trim() || !clientId || (!tenantAdminId && !managerId) || submitting} onClick={() => void submit()}>{submitting ? "Uploading..." : "Upload document"}</Button></div></div></DialogContent></Dialog>;
}

function DocumentUploadDialog({ workspace, clients, adminOptions, fixedCategory, open, onOpenChange, onCreated }: { workspace: "admin" | "employee"; clients: Array<{ id: string; name: string }>; adminOptions?: TenantAdminTaskOptions; fixedCategory?: (typeof categories)[number]; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (document: SharedDocument) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>(fixedCategory ?? "supporting");
  const [clientId, setClientId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [shareReason, setShareReason] = useState("");
  const [validUntilDate, setValidUntilDate] = useState("");
  const [validUntilTime, setValidUntilTime] = useState("23:59");
  const [submitting, setSubmitting] = useState(false);
  const selectedCategory = fixedCategory ?? category;
  const isAgreement = selectedCategory === "agreement";
  const canSubmit = Boolean(
    file &&
      title.trim() &&
      !submitting &&
      (isAgreement ? clientId && validUntilDate : clientId || employeeId),
  );
  const submit = async () => {
    if (!file || !title.trim()) return;
    if (isAgreement && (!clientId || !validUntilDate)) return;
    if (!isAgreement && !clientId && !employeeId) return;
    setSubmitting(true);
    try {
      onCreated(await createSharedDocument(workspace, {
        ...(clientId ? { clientId } : {}),
        file,
        title: title.trim(),
        fileName: file.name,
        fileType: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
        sizeBytes: file.size,
        category: selectedCategory,
        recipientEmployeeIds: employeeId ? [employeeId] : [],
        recipientClientIds: clientId ? [clientId] : [],
        shareReason,
        ...(isAgreement ? { validUntil: combineLocalDateTime(validUntilDate, validUntilTime) } : {}),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document could not be prepared.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Upload document"
        description={isAgreement ? "Choose the client who should receive this agreement." : "Send this file to a client, an employee, or both."}
        className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
      >
        <div className="pr-8">
          <h2 className="text-xl font-semibold">{isAgreement ? "Upload agreement" : "Upload document"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAgreement
              ? "Agreements stay linked to a client. You can also send a copy to an employee."
              : "Related client and employee are both optional, but you must choose at least one."}
          </p>
          <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
            <FileField file={file} onFile={setFile} />
            <label className="flex flex-col gap-1 text-sm font-medium">Document title<Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="flex flex-col gap-1 text-sm font-medium">Category<Select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</Select></label>
            <label className="flex flex-col gap-1 text-sm font-medium">{isAgreement ? "Related client" : "Related client (optional)"}<Select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">{isAgreement ? "Select client" : "No related client"}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></label>
            {workspace === "admin" ? <label className="flex flex-col gap-1 text-sm font-medium">Send to employee (optional)<Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">No employee</option>{adminOptions?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select></label> : null}
            {workspace === "admin" ? <label className="flex flex-col gap-1 text-sm font-medium">Why sent<Input value={shareReason} maxLength={1000} onChange={(event) => setShareReason(event.target.value)} /></label> : null}
            {isAgreement ? (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Expiry date
                  <DatePicker className="mt-1" value={validUntilDate} min={new Date().toISOString().slice(0, 10)} onChange={setValidUntilDate} aria-label="Expiry date" />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Expiry time
                  <Input className="mt-1" type="time" value={validUntilTime} onChange={(event) => setValidUntilTime(event.target.value)} />
                </label>
              </>
            ) : null}
          </div>
          <div className="mt-7 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!canSubmit} onClick={() => void submit()}>{submitting ? "Preparing..." : isAgreement ? "Upload agreement" : "Upload document"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceUploadDialog({ workspace, clients, open, onOpenChange, onCreated }: { workspace: "admin"; clients: Array<{ id: string; name: string }>; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (invoice: SharedInvoice) => void }) {
  const [file, setFile] = useState<File | null>(null); const [number, setNumber] = useState(""); const [clientId, setClientId] = useState(""); const [issuedOn, setIssuedOn] = useState(() => new Date().toISOString().slice(0, 10)); const [dueOn, setDueOn] = useState(""); const [amount, setAmount] = useState(""); const [visibility, setVisibility] = useState<"client" | "internal">("client"); const [submitting, setSubmitting] = useState(false); const eligibleClients = clients;
  const submit = async () => { if (!file || !number || !clientId || !amount) return; setSubmitting(true); try { onCreated(await createSharedInvoice(workspace, { clientId, file, invoiceNumber: number, issuedOn, dueOn, amount: Number(amount), visibility, fileName: file.name, fileType: file.name.split(".").pop()?.toUpperCase() ?? "FILE", sizeBytes: file.size })); } catch (error) { toast.error(error instanceof Error ? error.message : "Invoice could not be prepared."); } finally { setSubmitting(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent title="Upload invoice" description="Choose invoice metadata and authorised visibility." className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"><div className="pr-8"><h2 className="text-xl font-semibold">Upload invoice</h2><div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2"><FileField file={file} onFile={setFile} /><label className="flex flex-col gap-1 text-sm font-medium">Invoice number<Input value={number} onChange={(event) => setNumber(event.target.value)} /></label><label className="flex flex-col gap-1 text-sm font-medium">Related client<Select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Select client</option>{eligibleClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></label><label className="flex flex-col gap-1 text-sm font-medium">Amount (INR)<Input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="flex flex-col gap-1 text-sm font-medium">Invoice date<DatePicker value={issuedOn} onChange={setIssuedOn} aria-label="Invoice date" /></label><label className="flex flex-col gap-1 text-sm font-medium">Due date<DatePicker value={dueOn} onChange={setDueOn} aria-label="Due date" /></label><label className="flex flex-col gap-1 text-sm font-medium">Visibility<Select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="client">Client-visible invoice</option><option value="internal">Internal finance document</option></Select></label></div><div className="mt-7 flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!file || !number || !clientId || !amount || submitting} onClick={() => void submit()}>{submitting ? "Preparing…" : "Upload invoice"}</Button></div></div></DialogContent></Dialog>;
}
