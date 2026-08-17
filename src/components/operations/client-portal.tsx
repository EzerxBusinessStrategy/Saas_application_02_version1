"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import { getClientPortalDashboard } from "@/features/client-portal/api/client-portal-dashboard-api";
import {
  decideClientPortalDeliverable,
  getClientPortalDeliverableDownloadUrl,
  getClientPortalInvoiceDownloadUrl,
  listClientPortalDeliverables,
} from "@/features/client-portal/api/client-portal-deliverables-api";
import {
  createClientCatalogueRequest,
  getClientServiceCatalogue,
  listClientServiceRequests,
} from "@/features/client-portal/api/client-service-requests-api";
import { ClientServiceCustomizer, type ClientServiceDraftTask } from "@/components/tenant-administration/client-service-customizer";
import {
  getClientPortalProfile,
  updateClientPortalProfile,
  type ClientPortalProfile,
} from "@/features/client-portal/api/client-portal-profile-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ClientPortal({
  section = "overview",
}: {
  section?: "overview" | "services" | "requests" | "profile" | "deliverables" | "invoices";
}) {
  const query = useQuery({
    queryKey: ["client-portal-dashboard"],
    queryFn: getClientPortalDashboard,
    refetchInterval: 10_000,
    refetchOnWindowFocus: "always",
  });

  if (query.isPending) {
    return <LoadingState label="Loading client portal" rows={4} />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Client portal could not load"
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;

  if (section === "deliverables") {
    return <ClientDeliverables />;
  }
  if (section === "invoices") {
    return <ClientInvoices invoices={data.invoices} />;
  }
  if (section === "requests") {
    return <ClientRequests requests={data.requests} onChanged={() => void query.refetch()} />;
  }
  if (section === "services") {
    return <ClientServices services={data.services} />;
  }
  if (section === "profile") {
    return <ClientProfile />;
  }

  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: data.currencyCode,
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Service overview"
        description="Your active services, requests, and invoices."
      />
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border md:grid-cols-3"
        aria-label="Client service metrics"
      >
        {[
          { label: "Active services", value: String(data.activeServices) },
          { label: "Open requests", value: String(data.openRequests) },
          {
            label: "Outstanding invoices",
            value: currency.format(data.outstandingInvoices),
          },
        ].map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] lg:grid-cols-2">
        <ClientServices services={data.services} compact />
        <ClientRequests requests={data.requests} compact />
      </section>
    </div>
  );
}

function ClientInvoices({
  invoices,
}: {
  invoices: Awaited<ReturnType<typeof getClientPortalDashboard>>["invoices"];
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Invoices"
        description="Invoices issued by your tenant for this client account."
      />
      <Card>
        <CardContent className="pt-[30px]">
          {invoices.length ? (
            <ul className="flex flex-col divide-y">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0">
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {invoice.taskTitle ?? "Invoice"} · Issued {invoice.issuedOn}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(invoice.totalAmount, invoice.currencyCode)} · Outstanding {formatCurrency(invoice.outstandingAmount, invoice.currencyCode)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void getClientPortalInvoiceDownloadUrl(invoice.id)
                      .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
                      .catch((error) => toast.error(error instanceof Error ? error.message : "Invoice download could not be started."))}
                  >
                    Download invoice
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No invoices"
              description="Issued invoices for this client account will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientServices({
  services,
  compact = false,
}: {
  services: Awaited<ReturnType<typeof getClientPortalDashboard>>["services"];
  compact?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-[18px] text-primary" />
          Active services
        </CardTitle>
        <CardDescription>
          Live engagement and task status for your client account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {services.length ? (
          <ul className="flex flex-col divide-y">
            {services.map((service) => {
              const expanded = expandedId === service.id;
              const currency = service.currencyCode ?? "INR";
              return (
                <li key={service.id} className="py-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{service.engagementName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {service.serviceName}
                      </p>
                    </div>
                    <StatusBadge
                      status={service.status === "active" ? "on-track" : "pending"}
                    />
                  </div>
                  {service.assignedEmployeeName ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {service.assignedEmployeeName} · responsible person
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {service.completedTasks}/{service.totalTasks} tasks completed
                    {service.openTasks > 0 ? ` · ${service.openTasks} open` : ""}
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium">Progress</span>
                      <span className="text-muted-foreground">{service.progressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-control)] bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${service.progressPercent}%` }} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {service.nextDueAt
                      ? `Next due ${formatDate(service.nextDueAt)}`
                      : "No upcoming due date"}
                    {service.estimatedTotal != null
                      ? ` · ${formatCurrency(service.estimatedTotal, currency)}`
                      : ""}
                  </p>
                  {!compact && service.tasks.length ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedId(expanded ? null : service.id)}
                      >
                        {expanded ? "Hide tasks" : "View tasks"}
                      </Button>
                      {expanded ? (
                        <ul className="mt-3 flex flex-col divide-y rounded-[var(--radius-control)] border">
                          {service.tasks.map((task) => (
                            <li key={task.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                              <div>
                                <p className="font-medium">{task.title}</p>
                                <p className="mt-1 text-muted-foreground">
                                  {task.plannedDueAt ? formatDate(task.plannedDueAt) : "No due date"}
                                </p>
                              </div>
                              <StatusBadge status={mapTaskStatus(task.status)} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
            <EmptyState
              title="No active services"
              description="Tick services from Requests. After the tenant accepts and allots the responsible person, they appear here with dates and prices."
            />
        )}
        {!compact && services.length ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Status is derived from real engagement and task records, not mock checkpoints.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ClientRequests({
  requests,
  compact = false,
  onChanged,
}: {
  requests: Awaited<ReturnType<typeof getClientPortalDashboard>>["requests"];
  compact?: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ClientServiceDraftTask[]>>({});
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const catalogueQuery = useQuery({
    queryKey: ["client-service-catalogue"],
    queryFn: getClientServiceCatalogue,
    enabled: open,
  });
  const requestQuery = useQuery({
    queryKey: ["client-service-requests"],
    queryFn: listClientServiceRequests,
    enabled: !compact,
  });

  const catalogue = catalogueQuery.data?.services ?? [];
  const selected = catalogue.filter((service) => selectedIds.includes(service.serviceId));
  const listed = compact
    ? requests.map((request) => ({ ...request, comment: undefined as string | undefined }))
    : [
        ...(requestQuery.data ?? []).map((request) => ({
          id: request.id,
          title: request.title,
          status: request.status,
          comment: request.description.trim() || undefined,
          serviceName:
            request.services.map((service) => service.serviceName).join(", ") || "Custom request",
          countryCode: request.countryCode,
          requestedDueDate: null as string | null,
          submittedAt: request.submittedAt,
          updatedAt: request.updatedAt,
        })),
        ...requests
          .filter((request) => !(requestQuery.data ?? []).some((item) => item.id === request.id))
          .map((request) => ({ ...request, comment: undefined as string | undefined })),
      ];
  const canSend =
    (selected.length > 0 && selected.every((service) => (drafts[service.serviceId] ?? []).some((task) => task.enabled))) ||
    title.trim().length >= 2;

  function toggleService(serviceId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, serviceId])] : current.filter((id) => id !== serviceId),
    );
    const service = catalogue.find((item) => item.serviceId === serviceId);
    if (checked && service && !drafts[serviceId]) {
      setDrafts((current) => ({ ...current, [serviceId]: catalogueTasks(service.tasks) }));
    }
  }

  async function submit() {
    if (!canSend || comment.trim().length < 2) return;
    setSubmitting(true);
    try {
      await createClientCatalogueRequest({
        idempotencyKey: crypto.randomUUID(),
        kind: selected.length ? "catalogue" : "custom",
        countryCode: "IN",
        currencyCode:
          selected[0]?.currencyCode === "USD" || selected[0]?.currencyCode === "GBP"
            ? selected[0].currencyCode
            : "INR",
        title: title.trim() || undefined,
        description: comment.trim(),
        services: selected.map((service) => ({
          serviceId: service.serviceId,
          tasks: (drafts[service.serviceId] ?? catalogueTasks(service.tasks)).map((task) => ({
            taskType: task.taskType,
            title: task.title,
            frequency: task.frequency,
            dueRule: task.dueRule,
            unitType: task.unitType,
            rateAmount: task.rateAmount,
            taxCode: task.taxCode,
            enabled: task.enabled,
          })),
        })),
      });
      toast.success("Request sent. The tenant will allot the responsible person before work is created.");
      setCommentOpen(false);
      setOpen(false);
      setSelectedIds([]);
      setDrafts({});
      setTitle("");
      setComment("");
      onChanged?.();
      void requestQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Recent requests</CardTitle>
            <CardDescription>
              Tick services from the tenant catalogue, or send a custom request. Work is created after tenant accept.
            </CardDescription>
          </div>
          {!compact ? <Button size="sm" onClick={() => setOpen(true)}>Request services</Button> : null}
        </div>
      </CardHeader>
      <CardContent>
        {listed.length ? (
          <ul className="flex flex-col divide-y">
            {listed.map((request) => (
              <li key={request.id} className="py-4 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{request.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.serviceName} · {request.countryCode}
                    </p>
                    {request.comment ? (
                      <p className="mt-1 text-sm">Comment: {request.comment}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">
                      Updated {formatDate(request.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={mapRequestStatus(request.status)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No requests"
            description="Tick the services you need, or send a custom request, then wait for the tenant to accept."
          />
        )}
      </CardContent>
    </Card>
    <Dialog
      open={open && !commentOpen}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelectedIds([]);
          setDrafts({});
          setTitle("");
          setComment("");
          setCommentOpen(false);
        }
      }}
    >
      <DialogContent
        title="Request services"
        description="Choose from the tenant service list. You can change tasks, dates, and prices before sending. Design status: Pending Figma verification."
      >
        <div className="grid max-h-[70vh] gap-5 overflow-y-auto pr-8">
          {catalogueQuery.isError ? (
            <p className="rounded-[var(--radius-control)] border border-destructive/30 p-3 text-sm text-destructive">
              The service catalogue could not load.
            </p>
          ) : null}
          <section className="grid gap-3">
            <h3 className="text-sm font-medium">Tenant services</h3>
            {catalogueQuery.isPending ? <p className="text-sm text-muted-foreground">Loading services…</p> : null}
            {!catalogueQuery.isPending && !catalogue.length ? (
              <p className="text-sm text-muted-foreground">The tenant has not published a service booklet yet.</p>
            ) : null}
            {catalogue.map((service) => {
              const disabled = service.alreadyActive || service.alreadyRequested;
              return (
                <label key={service.serviceId} className="flex items-start gap-3 rounded-[var(--radius-control)] border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedIds.includes(service.serviceId)}
                    disabled={disabled}
                    aria-label={`Request ${service.name}`}
                    onChange={(event) => toggleService(service.serviceId, event.target.checked)}
                  />
                  <span>
                    <span className="font-medium">{service.name}</span>
                    <span className="mt-1 block text-muted-foreground">
                      {formatCurrency(service.estimatedAnnualTotal, service.currencyCode)}
                      {service.alreadyActive ? " · already purchased" : ""}
                      {service.alreadyRequested ? " · request waiting" : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </section>
          {selected.map((service) => (
            <ClientServiceCustomizer
              key={service.serviceId}
              serviceName={service.name}
              currencyCode={service.currencyCode}
              description="Change tasks, due dates, or prices for this request only."
              tasks={drafts[service.serviceId] ?? catalogueTasks(service.tasks)}
              onChange={(tasks) => setDrafts((current) => ({ ...current, [service.serviceId]: tasks }))}
            />
          ))}
          <label className="text-sm font-medium">
            Custom request title
            <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={submitting || !canSend} onClick={() => setCommentOpen(true)}>
              Send request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmationDialog
      open={commentOpen}
      onOpenChange={(next) => {
        setCommentOpen(next);
      }}
      title="Add a comment"
      description="This note is sent to the tenant with your service request."
      confirmLabel="Send request"
      isConfirming={submitting}
      confirmDisabled={comment.trim().length < 2}
      onConfirm={() => void submit()}
    >
      <label className="text-sm font-medium">
        Comment
        <textarea
          className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={comment}
          maxLength={2000}
          aria-label="Comment for the tenant"
          placeholder="Tell the tenant what you need."
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
    </ConfirmationDialog>
    </>
  );
}

function catalogueTasks(
  tasks: Awaited<ReturnType<typeof getClientServiceCatalogue>>["services"][number]["tasks"],
): ClientServiceDraftTask[] {
  return tasks.map((task) => ({
    taskType: task.taskType,
    title: task.taskType,
    frequency: task.frequency,
    dueRule: task.dueRule,
    unitType: task.unitType,
    rateAmount: task.rateAmount,
    taxCode: task.taxCode ?? "",
    enabled: true,
  }));
}

function ClientDeliverables() {
  const query = useQuery({
    queryKey: ["client-portal-deliverables"],
    queryFn: listClientPortalDeliverables,
  });

  if (query.isPending) {
    return <LoadingState label="Loading deliverables" rows={3} />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Deliverables could not load"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Deliverables"
        description="Documents shared by your tenant for your review."
      />
      <ClientDeliverablesList
        deliverables={query.data}
        onChanged={() => void query.refetch()}
      />
    </div>
  );
}

function ClientDeliverablesList({
  deliverables,
  onChanged,
}: {
  deliverables: Awaited<ReturnType<typeof listClientPortalDeliverables>>;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
    decision: "approved" | "rejected";
  } | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!selected) return;
    setSaving(true);
    try {
      await decideClientPortalDeliverable(selected.id, {
        decision: selected.decision,
        comment,
      });
      toast.success(
        selected.decision === "approved"
          ? "Deliverable approved."
          : "Deliverable rejected.",
      );
      setSelected(null);
      setComment("");
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Decision could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-[30px]">
          {deliverables.length ? (
            <ul className="flex flex-col divide-y">
              {deliverables.map((item) => (
                <li key={item.id} className="py-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.fileName} · {item.fileType} · {item.category}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Shared by {item.uploadedBy} · {formatDate(item.updatedOn)}
                      </p>
                      {item.clientDecisionComment ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Comment: {item.clientDecisionComment}
                        </p>
                      ) : null}
                    </div>
                    {item.category !== "invoice" ? (
                      <StatusBadge
                        status={
                          item.clientDecisionStatus === "approved"
                            ? "complete"
                            : item.clientDecisionStatus === "rejected"
                              ? "at-risk"
                              : "pending"
                        }
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void getClientPortalDeliverableDownloadUrl(item.id).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch((error) => toast.error(error instanceof Error ? error.message : "Document download could not be started."))}>
                      Download
                    </Button>
                    {item.category !== "invoice" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={saving}
                          onClick={() => {
                            setSelected({
                              id: item.id,
                              title: item.title,
                              decision: "approved",
                            });
                            setComment("");
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => {
                            setSelected({
                              id: item.id,
                              title: item.title,
                              decision: "rejected",
                            });
                            setComment(item.clientDecisionComment ?? "");
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No deliverables"
              description="Documents shared by your tenant for this client account will appear here."
            />
          )}
        </CardContent>
      </Card>
      {selected ? (
        <Dialog open onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent
            title={
              selected.decision === "approved"
                ? "Approve deliverable"
                : "Reject deliverable"
            }
            description={selected.title}
          >
            <div className="grid gap-4 pr-8">
              <p className="text-sm text-muted-foreground">
                {selected.decision === "approved"
                  ? "This will notify the tenant that the deliverable is approved."
                  : "Add a reason before sending this back to the tenant."}
              </p>
              <label className="text-sm font-medium">
                Comment
                <Input
                  className="mt-1"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={
                    selected.decision === "rejected"
                      ? "Reason for rejection"
                      : "Optional note"
                  }
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={
                    saving ||
                    (selected.decision === "rejected" && !comment.trim())
                  }
                  onClick={() => void submit()}
                >
                  {saving
                    ? "Saving..."
                    : selected.decision === "approved"
                      ? "Approve"
                      : "Reject"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function ClientProfile() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["client-portal-profile"],
    queryFn: getClientPortalProfile,
  });
  const [draft, setDraft] = useState<ClientPortalProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const profile = draft ?? query.data;
  const setField = (key: keyof ClientPortalProfile, value: string) => {
    setDraft({ ...(profile ?? defaultClientProfile), [key]: value });
  };
  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      const saved = await updateClientPortalProfile(profile);
      setDraft(saved);
      queryClient.setQueryData(["client-portal-profile"], saved);
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Profile"
        description="Customise your portal name and colours."
      />
      {query.isPending ? <LoadingState label="Loading profile" rows={2} /> : null}
      {query.isError ? <ErrorState title="Profile could not load" onRetry={() => void query.refetch()} /> : null}
      {profile ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <CardTitle>Profile settings</CardTitle>
              <CardDescription>Saved to your client account and loaded from the backend.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <label className="text-sm font-medium">
                Portal name
                <Input className="mt-1" value={profile.portalName} onChange={(event) => setField("portalName", event.target.value)} />
              </label>
              <div className="grid gap-5 sm:grid-cols-3">
                {(["primaryColour", "sidebarColour", "surfaceColour"] as const).map((key) => {
                  const label = key === "primaryColour" ? "Primary colour" : key === "sidebarColour" ? "Sidebar colour" : "Surface colour";
                  return (
                    <label key={key} className="text-sm font-medium">
                      {label}
                      <span className="mt-1 flex gap-2">
                        <Input value={profile[key]} onChange={(event) => setField(key, event.target.value.toUpperCase())} />
                        <input
                          aria-label={`Choose ${label.toLowerCase()}`}
                          className="size-10 shrink-0 rounded-[var(--radius-control)] border border-border bg-transparent p-1"
                          type="color"
                          value={/^#[0-9a-f]{6}$/i.test(profile[key]) ? profile[key] : "#000000"}
                          onChange={(event) => setField(key, event.target.value.toUpperCase())}
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save profile"}</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>Your client portal theme.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-[var(--radius-card)] border" style={{ backgroundColor: profile.surfaceColour, color: profile.sidebarColour }}>
                <div className="p-5 text-white" style={{ backgroundColor: profile.sidebarColour }}>
                  <p className="font-semibold">{profile.portalName}</p>
                  <p className="mt-4 text-sm text-white/75">Dashboard</p>
                  <p className="mt-2 text-sm text-white/75">Invoices</p>
                </div>
                <div className="p-5">
                  <p className="text-sm text-muted-foreground">Client workspace</p>
                  <div className="mt-4 rounded-[var(--radius-control)] p-3 text-sm font-medium text-white" style={{ backgroundColor: profile.primaryColour }}>
                    Primary action
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

const defaultClientProfile: ClientPortalProfile = {
  portalName: "Client portal",
  primaryColour: "#3C50E0",
  sidebarColour: "#1C2434",
  surfaceColour: "#FFFFFF",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

function mapTaskStatus(status: string) {
  if (status === "completed") return "complete";
  if (["cancelled"].includes(status)) return "pending";
  if (["in_progress", "submitted", "manager_review", "tenant_approval", "approved"].includes(status)) {
    return "on-track";
  }
  return "pending";
}

function mapRequestStatus(status: string) {
  if (["resolved", "completed", "approved", "accepted"].includes(status)) return "complete";
  if (["rejected", "cancelled"].includes(status)) return "blocked";
  if (["in_progress", "in-progress", "reviewed", "converted"].includes(status)) {
    return "on-track";
  }
  return "pending";
}
