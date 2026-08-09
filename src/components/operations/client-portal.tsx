"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import { getClientPortalDashboard } from "@/features/client-portal/api/client-portal-dashboard-api";
import {
  decideClientPortalDeliverable,
  listClientPortalDeliverables,
} from "@/features/client-portal/api/client-portal-deliverables-api";
import {
  createClientPortalServiceRequest,
  listClientPortalRequestServices,
} from "@/features/client-portal/api/client-portal-requests-api";
import {
  getClientPortalProfile,
  updateClientPortalProfile,
  type ClientPortalProfile,
} from "@/features/client-portal/api/client-portal-profile-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
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
import { Select } from "@/components/ui/select";

export function ClientPortal({
  section = "overview",
}: {
  section?: "overview" | "services" | "requests" | "profile" | "deliverables";
}) {
  const query = useQuery({
    queryKey: ["client-portal-dashboard"],
    queryFn: getClientPortalDashboard,
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

function ClientServices({
  services,
  compact = false,
}: {
  services: Awaited<ReturnType<typeof getClientPortalDashboard>>["services"];
  compact?: boolean;
}) {
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
            {services.map((service) => (
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
                <p className="mt-2 text-sm text-muted-foreground">
                  {service.completedTasks}/{service.totalTasks} tasks completed
                  {service.openTasks > 0 ? ` · ${service.openTasks} open` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {service.nextDueAt
                    ? `Next due ${formatDate(service.nextDueAt)}`
                    : "No upcoming due date"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No active services"
            description="Your tenant has not published any active services for this client account yet."
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
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [requestedDueDate, setRequestedDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const serviceQuery = useQuery({
    queryKey: ["client-portal-request-services"],
    queryFn: listClientPortalRequestServices,
    enabled: !compact,
  });

  async function submit() {
    if (!serviceId || !title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await createClientPortalServiceRequest({
        serviceId,
        title: title.trim(),
        description: description.trim(),
        countryCode,
        requestedDueDate: requestedDueDate || null,
        priority,
      });
      toast.success("Request sent to the tenant.");
      setOpen(false);
      setServiceId("");
      setTitle("");
      setDescription("");
      setRequestedDueDate("");
      setPriority("normal");
      onChanged?.();
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
              Requests created for this client account only.
            </CardDescription>
          </div>
          {!compact ? <Button size="sm" onClick={() => setOpen(true)}>Request service</Button> : null}
        </div>
      </CardHeader>
      <CardContent>
        {requests.length ? (
          <ul className="flex flex-col divide-y">
            {requests.map((request) => (
              <li key={request.id} className="py-4 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{request.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.serviceName} · {request.countryCode}
                    </p>
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
            description="Client requests will appear here once they are submitted."
          />
        )}
      </CardContent>
    </Card>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Request service" description="Select a tenant service and send the request.">
        <div className="grid gap-4 pr-8">
          {serviceQuery.isError ? (
            <p className="rounded-[var(--radius-control)] border border-destructive/30 p-3 text-sm text-destructive">
              Services could not load.
            </p>
          ) : null}
          <label className="text-sm font-medium">
            Service
            <Select
              className="mt-1"
              value={serviceId}
              onChange={(event) => {
                const nextServiceId = event.target.value;
                setServiceId(nextServiceId);
                const service = serviceQuery.data?.find((item) => item.id === nextServiceId);
                if (service && !title.trim()) setTitle(service.name);
              }}
            >
              <option value="">{serviceQuery.isPending ? "Loading services..." : "Select service"}</option>
              {(serviceQuery.data ?? []).map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium">
            Request title
            <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Description
            <textarea
              className="mt-1 min-h-28 w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Country
              <Input className="mt-1 uppercase" maxLength={2} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} />
            </label>
            <label className="text-sm font-medium">
              Due date
              <Input className="mt-1" type="date" value={requestedDueDate} onChange={(event) => setRequestedDueDate(event.target.value)} />
            </label>
            <label className="text-sm font-medium">
              Priority
              <Select className="mt-1" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={submitting || !serviceId || !title.trim() || !description.trim()} onClick={() => void submit()}>
              {submitting ? "Sending..." : "Send request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
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
                    <StatusBadge
                      status={
                        item.clientDecisionStatus === "approved"
                          ? "complete"
                          : item.clientDecisionStatus === "rejected"
                            ? "at-risk"
                            : "pending"
                      }
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
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

function mapRequestStatus(status: string) {
  if (["resolved", "completed", "approved"].includes(status)) return "complete";
  if (["in_progress", "in-progress", "reviewed", "converted"].includes(status)) {
    return "on-track";
  }
  return "pending";
}
