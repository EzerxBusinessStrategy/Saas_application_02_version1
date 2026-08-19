"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  getClientPortalDashboard,
  type ClientPortalDashboard,
} from "@/features/client-portal/api/client-portal-dashboard-api";
import { formatMonthLabel, summarizeClientServiceSchedule } from "@/features/client-portal/client-service-pricing";
import { openSignedDownloadUrl } from "@/lib/signed-download";
import { ClientServices } from "@/components/operations/client-portal-services";
import {
  clientRequestStatusTone,
  formatClientDate,
  formatClientMoney,
  humanizeClientStatus,
} from "@/components/operations/client-portal-display";
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
import { DashboardGreetingBanner } from "@/components/shared/dashboard-greeting-banner";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/date-picker";
import { formatDashboardMonthLabel } from "@/lib/dashboard-greeting";

const CLIENT_DASHBOARD_MAX_SPAN_DAYS = 731;
const CLIENT_DASHBOARD_MAX_FUTURE_DAYS = 366;

type ClientDashboardPreset = "custom" | "this_month" | "last_30_days" | "upcoming_year";

type AuthenticatedProfile = {
  readonly user: {
    readonly displayName: string;
  };
};

export function ClientPortal({
  section = "overview",
}: {
  section?: "overview" | "services" | "requests" | "profile" | "deliverables" | "invoices";
}) {
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [preset, setPreset] = useState<ClientDashboardPreset>("custom");
  const [profileName, setProfileName] = useState("Client");
  const [portalName, setPortalName] = useState<string | undefined>();
  const needsDashboard = section !== "profile" && section !== "deliverables";

  useEffect(() => {
    if (section !== "overview") return;
    const controller = new AbortController();
    void fetch("/api/me?portal=client", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as AuthenticatedProfile) : null))
      .then((response) => {
        if (response?.user.displayName) setProfileName(response.user.displayName);
      })
      .catch(() => undefined);
    void getClientPortalProfile()
      .then((profile) => setPortalName(profile.portalName))
      .catch(() => undefined);
    return () => controller.abort();
  }, [section]);
  const query = useQuery({
    queryKey: ["client-portal-dashboard", applied.from ?? "", applied.to ?? ""],
    queryFn: () => getClientPortalDashboard({ from: applied.from, to: applied.to }),
    enabled: needsDashboard,
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
    refetchOnWindowFocus: "always",
  });

  if (section === "deliverables") {
    return <ClientDeliverables />;
  }
  if (section === "profile") {
    return <ClientProfile />;
  }

  if (query.isPending && !query.data) {
    return <LoadingState label="Loading client portal" rows={4} />;
  }
  if (query.isError && !query.data) {
    return (
      <ErrorState
        title="Client portal could not load"
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data) {
    return <LoadingState label="Loading client portal" rows={4} />;
  }

  const period = data.period;
  const fromValue = draftFrom ?? period.from;
  const toValue = draftTo ?? period.to;
  const incompleteRange = Boolean(fromValue) !== Boolean(toValue);
  const invertedRange = Boolean(fromValue && toValue && fromValue > toValue);
  const oversizedRange = Boolean(
    fromValue && toValue && isoDateDiffDays(fromValue, toValue) > CLIENT_DASHBOARD_MAX_SPAN_DAYS,
  );
  const invalidRange = incompleteRange || invertedRange || oversizedRange;
  const filtersDirty = fromValue !== period.from || toValue !== period.to;
  const selectValue: ClientDashboardPreset =
    draftFrom === null && draftTo === null
      ? period.source === "query"
        ? "custom"
        : period.source
      : preset;
  const periodDescription = `Showing ${formatLocalIsoDate(period.from)} – ${formatLocalIsoDate(period.to)} (${periodSourceLabel(period.source)}).`;

  function applyRange(from: string, to: string, nextPreset: ClientDashboardPreset) {
    if (!from || !to || from > to || isoDateDiffDays(from, to) > CLIENT_DASHBOARD_MAX_SPAN_DAYS) {
      return;
    }
    setDraftFrom(from);
    setDraftTo(to);
    setPreset(nextPreset);
    setApplied({ from, to });
  }

  function applyDraft() {
    applyRange(fromValue, toValue, "custom");
  }

  function applyPreset(next: ClientDashboardPreset) {
    switch (next) {
      case "custom":
        setPreset("custom");
        return;
      case "last_30_days": {
        const today = toLocalIsoDate(new Date());
        applyRange(addLocalIsoDays(today, -29), today, "last_30_days");
        return;
      }
      case "this_month": {
        const today = toLocalIsoDate(new Date());
        const monthStart = `${today.slice(0, 8)}01`;
        const monthEndDate = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0);
        applyRange(monthStart, toLocalIsoDate(monthEndDate), "this_month");
        return;
      }
      case "upcoming_year": {
        const today = toLocalIsoDate(new Date());
        applyRange(
          `${today.slice(0, 8)}01`,
          addLocalIsoDays(today, CLIENT_DASHBOARD_MAX_FUTURE_DAYS),
          "upcoming_year",
        );
        return;
      }
      default: {
        const exhaustive: never = next;
        return exhaustive;
      }
    }
  }

  function resetPeriod() {
    setDraftFrom(null);
    setDraftTo(null);
    setPreset("custom");
    setApplied({});
  }

  const periodFilter = (
    <ClientPortalPeriodFilter
      fromValue={fromValue}
      toValue={toValue}
      selectValue={selectValue}
      invalidRange={invalidRange}
      incompleteRange={incompleteRange}
      invertedRange={invertedRange}
      filtersDirty={filtersDirty}
      isFetching={query.isFetching}
      activeFilterCount={applied.from && applied.to ? 1 : 0}
      onFromChange={(value) => {
        setPreset("custom");
        setDraftFrom(value);
      }}
      onToChange={(value) => {
        setPreset("custom");
        setDraftTo(value);
      }}
      onPresetChange={applyPreset}
      onApply={applyDraft}
      onClear={resetPeriod}
    />
  );

  if (section === "invoices") {
    return (
      <div className="flex flex-col gap-[30px]">
        <PageHeader
          eyebrow="Client portal"
          title="Invoices"
          description={periodDescription}
        />
        {periodFilter}
        <ClientInvoices invoices={data.invoices} />
      </div>
    );
  }
  if (section === "requests") {
    return (
      <div className="flex flex-col gap-[30px]">
        <PageHeader
          eyebrow="Client portal"
          title="Requests"
          description={periodDescription}
        />
        {periodFilter}
        <ClientRequests
          requests={data.requests}
          period={period}
          onChanged={() => void query.refetch()}
        />
      </div>
    );
  }
  if (section === "services") {
    return (
      <div className="flex flex-col gap-[30px]">
        <PageHeader
          eyebrow="Client portal"
          title="Active services"
          description="Track progress, upcoming work and scheduled billing."
        />
        <ClientServices
          services={data.services}
          currencyCode={data.currencyCode}
          period={{
            fromValue,
            toValue,
            selectValue,
            invalidRange,
            incompleteRange,
            invertedRange,
            filtersDirty,
            isFetching: query.isFetching,
            activeFilterCount: applied.from && applied.to ? 1 : 0,
            onFromChange: (value) => {
              setPreset("custom");
              setDraftFrom(value);
            },
            onToChange: (value) => {
              setPreset("custom");
              setDraftTo(value);
            },
            onPresetChange: applyPreset,
            onApply: applyDraft,
            onClear: resetPeriod,
          }}
        />
      </div>
    );
  }

  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: data.currencyCode,
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-[30px]">
      <DashboardGreetingBanner
        userName={profileName}
        organizationName={portalName}
        subtitle={`${formatDashboardMonthLabel()} · ${periodSourceLabel(period.source)} · ${data.pendingTasks + data.completedTasks} tasks · ${data.pendingTasks} open`}
      />
      {periodFilter}
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-5"
        aria-label="Client service metrics"
        aria-busy={query.isFetching}
      >
        {[
          { label: "Active services", value: String(data.activeServices) },
          { label: "Open tasks", value: String(data.pendingTasks) },
          { label: "Completed", value: String(data.completedTasks) },
          { label: "Requests", value: String(data.openRequests) },
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
      <section className="grid items-start gap-[30px] lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <ClientServices services={data.services} compact />
        <div className="grid gap-[30px]">
          <ClientRequests
            requests={data.requests}
            period={period}
            compact
            onChanged={() => void query.refetch()}
          />
          <ClientBillingRail
            services={data.services}
            invoices={data.invoices}
            outstandingInvoices={data.outstandingInvoices}
            currencyCode={data.currencyCode}
          />
        </div>
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
    <Card>
      <CardContent className="pt-[30px]">
        {invoices.length ? (
          <ul className="flex flex-col divide-y">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {invoice.serviceName
                      ? `${invoice.serviceName}${invoice.billingLabel ? ` · ${invoice.billingLabel}` : ""}${invoice.itemCount > 1 ? ` · ${invoice.itemCount} items` : ""}`
                      : (invoice.taskTitle ?? "Invoice")}
                    {" · Due "}
                    {invoice.dueOn ?? invoice.issuedOn}
                  </p>
                  {invoice.items.length > 1 ? (
                    <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      {invoice.items.map((item) => (
                        <li key={item.description} className="flex justify-between gap-3">
                          <span>{item.description}</span>
                          <span>{formatClientMoney(item.netAmount, invoice.currencyCode)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatClientMoney(invoice.totalAmount, invoice.currencyCode)} · Outstanding {formatClientMoney(invoice.outstandingAmount, invoice.currencyCode)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void openSignedDownloadUrl(() => getClientPortalInvoiceDownloadUrl(invoice.id)).catch((error) =>
                      toast.error(error instanceof Error ? error.message : "Invoice download could not be started."),
                    )
                  }
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
  );
}

function ClientBillingRail({
  services,
  invoices,
  outstandingInvoices,
  currencyCode,
}: {
  services: ClientPortalDashboard["services"];
  invoices: ClientPortalDashboard["invoices"];
  outstandingInvoices: number;
  currencyCode: string;
}) {
  const schedule = services.reduce(
    (totals, service) => {
      const month = summarizeClientServiceSchedule(service.tasks, service.discountPercent);
      return {
        thisMonthDue: totals.thisMonthDue + month.thisMonthDue,
        nextMonthDue: totals.nextMonthDue + month.nextMonthDue,
        thisMonthKey: month.thisMonthKey,
        nextMonthKey: month.nextMonthKey,
      };
    },
    { thisMonthDue: 0, nextMonthDue: 0, thisMonthKey: "", nextMonthKey: "" },
  );
  const openInvoiceCount = invoices.filter((invoice) => invoice.outstandingAmount > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming billing</CardTitle>
        <CardDescription>Amounts come from scheduled tasks and issued invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              {schedule.thisMonthKey ? formatMonthLabel(schedule.thisMonthKey) : "This month"}
            </dt>
            <dd className="font-medium">{formatClientMoney(schedule.thisMonthDue, currencyCode)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              {schedule.nextMonthKey ? formatMonthLabel(schedule.nextMonthKey) : "Next month"}
            </dt>
            <dd className="font-medium">{formatClientMoney(schedule.nextMonthDue, currencyCode)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Outstanding</dt>
            <dd className="font-medium">{formatClientMoney(outstandingInvoices, currencyCode)}</dd>
          </div>
          <p className="text-muted-foreground">
            {openInvoiceCount} {openInvoiceCount === 1 ? "invoice" : "invoices"} with a balance
          </p>
        </dl>
        <Link href="/client/invoices" className="mt-4 inline-flex text-sm font-medium text-primary">
          View invoices →
        </Link>
      </CardContent>
    </Card>
  );
}

function ClientRequests({
  requests,
  compact = false,
  onChanged,
  period,
}: {
  requests: Awaited<ReturnType<typeof getClientPortalDashboard>>["requests"];
  compact?: boolean;
  onChanged?: () => void;
  period: ClientPortalDashboard["period"];
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
  const visible = listed.filter((item) => {
    const day = item.submittedAt.slice(0, 10);
    return day >= period.from && day <= period.to;
  });
  const timeline = compact
    ? [...visible]
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, 3)
    : visible;
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
      toast.success("Request sent. The tenant will accept it before work is created.");
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
              {compact
                ? "Latest requests from this account."
                : "Tick services from the tenant catalogue, or send a custom request. Work is created after tenant accept."}
            </CardDescription>
          </div>
          {compact ? (
            <Link href="/client/requests" className="shrink-0 text-sm font-medium text-primary">
              View all
            </Link>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)}>Request services</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {timeline.length ? (
          <ul className={compact ? "flex flex-col gap-4" : "flex flex-col divide-y"}>
            {timeline.map((request) => {
              const showService =
                request.serviceName.trim() &&
                request.serviceName.trim().toLowerCase() !== request.title.trim().toLowerCase();
              return (
                <li
                  key={request.id}
                  className={compact ? "relative pl-5" : "py-4 first:pt-0"}
                >
                  {compact ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 size-2 rounded-full bg-primary"
                    />
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{request.title}</p>
                      {showService ? (
                        <p className="mt-1 text-sm text-muted-foreground">{request.serviceName}</p>
                      ) : null}
                      {!compact && request.comment ? (
                        <p className="mt-1 text-sm">Comment: {request.comment}</p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted-foreground">
                        Updated {formatClientDate(request.updatedAt)}
                      </p>
                    </div>
                    <Badge tone={clientRequestStatusTone(request.status)}>
                      {humanizeClientStatus(request.status)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title={compact ? "No active requests" : "No requests"}
            description={
              compact
                ? "Need another service? Browse your available service catalogue."
                : "Tick the services you need, or send a custom request, then wait for the tenant to accept."
            }
          />
        )}
        {compact ? (
          <Button className="mt-4" size="sm" variant="outline" onClick={() => setOpen(true)}>
            Request service
          </Button>
        ) : null}
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
        description="Choose from the tenant service list. You can change tasks, dates, and prices before sending."
        className="max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] max-w-2xl overflow-y-auto"
      >
        <div className="grid min-w-0 gap-5 pr-8">
          <div>
            <h2 className="text-lg font-semibold">Request services</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose from the tenant service list. You can change tasks, dates, and prices before sending.
            </p>
          </div>
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
                      {formatClientMoney(service.estimatedAnnualTotal, service.currencyCode)}
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
              {deliverables.map((item) => {
                const isExpiredAgreement =
                  item.category === "agreement" && item.accessStatus === "expired";

                return (
                <li key={item.id} className="py-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.fileName} · {item.fileType} · {item.category}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Shared by {item.uploadedBy} · {formatClientDate(item.updatedOn)}
                      </p>
                      {item.validUntil ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Expires {formatClientDate(item.validUntil)}
                        </p>
                      ) : null}
                      {isExpiredAgreement ? (
                        <p className="mt-2 text-sm text-destructive">
                          This agreement has expired. Contact your tenant administrator for a renewed copy.
                        </p>
                      ) : null}
                      {item.clientDecisionComment ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Comment: {item.clientDecisionComment}
                        </p>
                      ) : null}
                    </div>
                    {item.category !== "invoice" ? (
                      isExpiredAgreement ? (
                        <Badge tone="danger">Expired</Badge>
                      ) : (
                        <StatusBadge
                          status={
                            item.clientDecisionStatus === "approved"
                              ? "complete"
                              : item.clientDecisionStatus === "rejected"
                                ? "at-risk"
                                : "pending"
                          }
                        />
                      )
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isExpiredAgreement}
                      onClick={() =>
                        void openSignedDownloadUrl(() => getClientPortalDeliverableDownloadUrl(item.id)).catch(
                          (error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Document download could not be started.",
                            ),
                        )
                      }
                    >
                      Download
                    </Button>
                    {item.category !== "invoice" && !isExpiredAgreement ? (
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
              )})}
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

function ClientPortalPeriodFilter({
  fromValue,
  toValue,
  selectValue,
  invalidRange,
  incompleteRange,
  invertedRange,
  filtersDirty,
  isFetching,
  activeFilterCount,
  onFromChange,
  onToChange,
  onPresetChange,
  onApply,
  onClear,
}: {
  fromValue: string;
  toValue: string;
  selectValue: ClientDashboardPreset;
  invalidRange: boolean;
  incompleteRange: boolean;
  invertedRange: boolean;
  filtersDirty: boolean;
  isFetching: boolean;
  activeFilterCount: number;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPresetChange: (value: ClientDashboardPreset) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <FilterToolbar
      activeFilterCount={activeFilterCount}
      onClear={onClear}
      trailing={
        <Button type="button" disabled={!filtersDirty || invalidRange || isFetching} onClick={onApply}>
          Apply dates
        </Button>
      }
    >
      <label className="text-sm font-medium">
        Period
        <Select
          className="mt-1"
          aria-label="Dashboard date preset"
          value={selectValue}
          onChange={(event) => onPresetChange(event.target.value as ClientDashboardPreset)}
        >
          <option value="custom">Custom range</option>
          <option value="this_month">This month</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="upcoming_year">Next 12 months</option>
        </Select>
      </label>
      <label className="text-sm font-medium">
        From
        <DatePicker
          className="mt-1"
          aria-label="Dashboard from date"
          value={fromValue}
          onChange={onFromChange}
        />
      </label>
      <label className="text-sm font-medium">
        To
        <DatePicker
          className="mt-1"
          aria-label="Dashboard to date"
          value={toValue}
          onChange={onToChange}
        />
      </label>
      {invalidRange ? (
        <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-1">
          {incompleteRange
            ? "Choose both a start and end date."
            : invertedRange
              ? "The end date must be on or after the start date."
              : "The range cannot exceed 731 days."}
        </p>
      ) : null}
    </FilterToolbar>
  );
}

function formatLocalIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addLocalIsoDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function isoDateDiffDays(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function periodSourceLabel(source: ClientPortalDashboard["period"]["source"]) {
  switch (source) {
    case "last_30_days":
      return "last 30 days";
    case "upcoming_year":
      return "next 12 months";
    case "query":
      return "selected dates";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}
