"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ServiceEmployeeSelector } from "@/components/tenant-administration/service-employee-selector";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/operations/data-table";
import { listClientServiceOnboardingAssignees } from "@/features/administration/api/service-onboarding-api";
import {
  acceptTenantServiceRequest,
  listTenantServiceRequests,
  rejectTenantServiceRequest,
  type TenantServiceRequest,
} from "@/features/administration/api/tenant-service-requests-api";
import type { ColumnDef } from "@tanstack/react-table";

export function TenantServiceRequestsInbox() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"submitted" | "all">("submitted");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["tenant-service-requests", status],
    queryFn: () => listTenantServiceRequests(status === "all" ? undefined : "submitted"),
  });

  if (query.isPending) return <LoadingState label="Loading client requests" rows={5} />;
  if (query.isError) return <ErrorState title="Client requests could not load" onRetry={() => void query.refetch()} />;

  const selected = query.data.find((request) => request.id === selectedId) ?? null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Client requests</CardTitle>
              <CardDescription>
                Clients tick services from your catalogue. Accept a request and allot the responsible employee to create the scheduled tasks.
              </CardDescription>
            </div>
            <Select
              aria-label="Filter request status"
              value={status}
              onChange={(event) => setStatus(event.target.value === "all" ? "all" : "submitted")}
            >
              <option value="submitted">Waiting for review</option>
              <option value="all">All requests</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {query.data.length ? (
            <DataTable
              caption="Client service requests"
              columns={columns(setSelectedId)}
              data={[...query.data]}
              emptyTitle="No service requests"
              emptyDescription="Client catalogue and custom requests will appear here."
            />
          ) : (
            <EmptyState
              title={status === "submitted" ? "No requests waiting" : "No service requests"}
              description="When a client ticks services or sends a custom request, review it here before work is created."
            />
          )}
        </CardContent>
      </Card>
      <RequestReviewDialog
        request={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["tenant-service-requests"] });
          void queryClient.invalidateQueries({ queryKey: ["tenant-admin-tasks"] });
          void queryClient.invalidateQueries({ queryKey: ["admin-operations-overview"] });
          void query.refetch();
        }}
      />
    </>
  );
}

function columns(onOpen: (id: string) => void): ColumnDef<TenantServiceRequest, unknown>[] {
  return [
    {
      header: "Client",
      accessorKey: "clientName",
    },
    {
      header: "Request",
      accessorKey: "title",
    },
    {
      header: "Client comment",
      accessorFn: (row) => row.description.trim() || "—",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-xs text-sm">
          {row.original.description.trim() || "—"}
        </span>
      ),
    },
    {
      header: "Type",
      accessorFn: (row) => (row.kind === "custom" ? "Custom" : "Catalogue"),
    },
    {
      header: "Status",
      cell: ({ row }) => <StatusBadge status={mapStatus(row.original.status)} />,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpen(row.original.id)}>
          Review
        </Button>
      ),
    },
  ];
}

function RequestReviewDialog({
  request,
  onOpenChange,
  onChanged,
}: {
  request: TenantServiceRequest | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const open = Boolean(request);
  const serviceIds = request?.services.map((service) => service.serviceId) ?? [];
  const assigneeQueries = useQueries({
    queries: serviceIds.map((serviceId) => ({
      queryKey: ["client-service-onboarding-assignees", request?.clientId, serviceId],
      queryFn: () => listClientServiceOnboardingAssignees(request!.clientId, serviceId),
      enabled: open && request?.kind === "catalogue",
    })),
  });

  const canAccept = useMemo(() => {
    if (!request || request.status !== "submitted") return false;
    if (request.kind === "custom") return true;
    return request.services.every((service) => assignments[service.serviceId]);
  }, [assignments, request]);

  async function accept() {
    if (!request) return;
    const discountPercent = parseDiscountPercent(discountInput);
    if (discountPercent === "invalid") {
      toast.error("Discount must be a number between 0 and 100.");
      return;
    }
    setSaving(true);
    try {
      await acceptTenantServiceRequest(request.id, {
        remarks: remarks.trim() || undefined,
        discountPercent,
        assignments: request.services.map((service) => ({
          serviceId: service.serviceId,
          assignedEmployeeId: assignments[service.serviceId] ?? "",
        })),
      });
      toast.success(request.kind === "custom" ? "Custom request accepted." : "Services activated and tasks created.");
      onOpenChange(false);
      setRemarks("");
      setDiscountInput("");
      setAssignments({});
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request could not be accepted.");
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    if (!request || remarks.trim().length < 2) {
      toast.error("Add a short remark before rejecting.");
      return;
    }
    setSaving(true);
    try {
      await rejectTenantServiceRequest(request.id, remarks.trim());
      toast.success("Request rejected.");
      onOpenChange(false);
      setRemarks("");
      setDiscountInput("");
      setAssignments({});
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request could not be rejected.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRemarks("");
          setDiscountInput("");
          setAssignments({});
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        title={request?.title ?? "Service request"}
        description={
          request
            ? `${request.clientName} · ${request.kind === "custom" ? "Custom request" : "Catalogue request"}`
            : "Review the client request."
        }
        className="max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] max-w-2xl overflow-y-auto"
      >
        {request ? (
          <div className="min-w-0 pr-10">
            <h2 className="text-lg font-semibold">{request.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.clientName} · {request.kind === "custom" ? "Custom request" : "Catalogue request"}
            </p>
            <div className="mt-5 space-y-5">
              <section className="rounded-[var(--radius-control)] border bg-muted/30 p-4">
                <h3 className="text-sm font-medium">Client comment</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {request.description.trim() || "No comment was added."}
                </p>
              </section>
              {request.kind === "custom" ? (
                <p className="text-sm text-muted-foreground">
                  Custom requests do not create tasks. Accept to record the review, then use Configure services if you later map this to a catalogue service.
                </p>
              ) : (
                request.services.map((service, index) => (
                  <section key={service.serviceId} className="rounded-[var(--radius-control)] border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{service.serviceName}</h3>
                      <p className="shrink-0 text-sm font-medium">
                        {formatMoney(service.estimatedTotal, request.currencyCode)}
                      </p>
                    </div>
                    <ul className="mt-3 flex flex-col divide-y text-sm">
                      {service.tasks.map((task, taskIndex) => (
                        <li key={`${task.taskType}-${taskIndex}`} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                          <span>{task.title || task.taskType}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {task.frequency} · {formatMoney(task.rateAmount, request.currencyCode)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {request.status === "submitted" ? (
                      <div className="mt-4 border-t pt-4">
                        <ServiceEmployeeSelector
                          className="border-0 p-0"
                          showHeading={false}
                          serviceName={service.serviceName}
                          employees={assigneeQueries[index]?.data ?? []}
                          isLoading={assigneeQueries[index]?.isPending ?? false}
                          value={assignments[service.serviceId] ?? ""}
                          onChange={(employeeId) =>
                            setAssignments((current) => ({ ...current, [service.serviceId]: employeeId }))
                          }
                        />
                      </div>
                    ) : null}
                  </section>
                ))
              )}
              {request.status === "submitted" ? (
                <div className="grid gap-5">
                  {request.kind === "catalogue" ? (
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      Discount (%)
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.01"
                        placeholder="No discount"
                        value={discountInput}
                        onChange={(event) => setDiscountInput(event.target.value)}
                      />
                      <span className="text-xs font-normal text-muted-foreground">
                        Optional. Applied to each accepted service&apos;s task total and shown to the client.
                      </span>
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Remarks
                    <Input value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                  </label>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {request.status} {request.reviewRemarks ? `· ${request.reviewRemarks}` : ""}
                </p>
              )}
            </div>
            {request.status === "submitted" ? (
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={() => void reject()}>
                  Reject
                </Button>
                <Button type="button" disabled={saving || !canAccept} onClick={() => void accept()}>
                  {saving ? "Saving…" : request.kind === "custom" ? "Accept request" : "Accept and activate"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function mapStatus(status: TenantServiceRequest["status"]) {
  switch (status) {
    case "accepted":
      return "complete" as const;
    case "rejected":
    case "cancelled":
      return "blocked" as const;
    case "submitted":
      return "pending" as const;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function parseDiscountPercent(value: string): number | undefined | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return "invalid";
  const rounded = Math.round(parsed * 100) / 100;
  return rounded > 0 ? rounded : undefined;
}

function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
