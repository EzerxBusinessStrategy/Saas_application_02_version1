"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createTenantAdminService,
  getTenantAdminServiceAllocations,
  listTenantAdminServices,
  setTenantAdminServiceStatus,
  setTenantAdminServiceTaskStatus,
  type CreateTenantAdminServiceInput,
  type TenantAdminService,
  type TenantAdminServiceAllocations,
} from "@/features/operations/api/operations-api";
import { ServiceBlueprintEditor } from "@/components/tenant-administration/service-blueprint-editor";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/date-picker";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { StatusBadge } from "@/components/shared/status-badge";

const MAX_INLINE_TASKS = 5;

type ServiceDetailsTarget = {
  serviceId: string;
  serviceName: string;
  rateItemId?: string;
  taskType?: string;
};

type TenantAdminServiceRate = TenantAdminService["rates"][number];

const serviceInput = {
  name: "",
  taskType: "",
  unitType: "per_task" as CreateTenantAdminServiceInput["unitType"],
  rateAmount: "",
  currencyCode: "INR" as CreateTenantAdminServiceInput["currencyCode"],
  taxCode: "",
  effectiveFrom: new Date().toISOString().slice(0, 10),
};

export function TenantServiceDirectory() {
  const queryClient = useQueryClient();
  const [blueprintService, setBlueprintService] = useState<{ id: string; name: string } | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<ServiceDetailsTarget | null>(null);
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(() => new Set());
  const [updatingRateItemId, setUpdatingRateItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["tenant-admin-services"],
    queryFn: listTenantAdminServices,
  });

  const filteredServices = useMemo(() => {
    const services = query.data ?? [];
    const needle = search.trim().toLowerCase();
    return services.filter((service) => {
      if (statusFilter && service.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        service.name,
        service.code,
        serviceSubtitle(service),
        ...service.rates.map((rate) => [rate.taskType, rate.clientName ?? ""].join(" ")),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query.data, search, statusFilter]);

  const toggleExpanded = (serviceId: string) => {
    setExpandedServiceIds((current) => {
      const next = new Set(current);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const openBlueprint = (service: { id: string; name: string }) => {
    setBlueprintService(service);
  };

  const setServiceStatus = async (serviceId: string, status: "active" | "inactive") => {
    setUpdatingServiceId(serviceId);
    try {
      const result = await setTenantAdminServiceStatus({ serviceId, status });
      toast.success(
        result.status === "inactive"
          ? `"${result.name}" is disabled and hidden from the client service request form.`
          : `"${result.name}" is enabled and visible in the client service request form.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["tenant-admin-services"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant-admin-task-options"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The service status could not be updated.");
    } finally {
      setUpdatingServiceId(null);
    }
  };

  const setTaskStatus = async (serviceId: string, rateItemId: string, status: "active" | "inactive") => {
    setUpdatingRateItemId(rateItemId);
    try {
      const result = await setTenantAdminServiceTaskStatus({ serviceId, rateItemId, status });
      toast.success(
        result.status === "inactive"
          ? `"${result.taskType}" is disabled and hidden from the client service request form.`
          : `"${result.taskType}" is enabled and visible in the client service request form.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["tenant-admin-services"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant-admin-task-options"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The task status could not be updated.");
    } finally {
      setUpdatingRateItemId(null);
    }
  };

  if (query.isPending) return <LoadingState label="Loading services and rates" rows={5} />;
  if (query.isError) return <ErrorState title="Services could not load" onRetry={() => void query.refetch()} />;

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Services"
        description="Manage your service catalogue, tasks and pricing."
        actions={
          <NewServiceDialog
            onCreated={() => {
              void queryClient.invalidateQueries({ queryKey: ["tenant-admin-services"] });
              void queryClient.invalidateQueries({ queryKey: ["tenant-admin-task-options"] });
            }}
          />
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-5 pt-[30px]">
          <FilterToolbar
            filterGridClassName="grid gap-3 sm:grid-cols-2"
            search={{
              value: search,
              onChange: setSearch,
              label: "Search services",
              placeholder: "Search services...",
            }}
            activeFilterCount={Number(Boolean(statusFilter))}
            onClear={() => {
              setSearch("");
              setStatusFilter("");
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <Select
                aria-label="Filter service status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
          </FilterToolbar>

          {query.data?.length ? (
            filteredServices.length ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b pb-3 text-sm">
                  <p className="font-medium">Services</p>
                  <p className="text-muted-foreground">
                    {filteredServices.length} service{filteredServices.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ServiceHierarchyList
                  services={filteredServices}
                  expandedServiceIds={expandedServiceIds}
                  updatingServiceId={updatingServiceId}
                  updatingRateItemId={updatingRateItemId}
                  onToggleExpanded={toggleExpanded}
                  onManageService={openBlueprint}
                  onShowDetails={setDetailsTarget}
                  onSetServiceStatus={setServiceStatus}
                  onSetTaskStatus={setTaskStatus}
                />
              </>
            ) : (
              <EmptyState
                title="No services match these filters"
                description="Clear the search or filters to see the full service list."
              />
            )
          ) : (
            <EmptyState
              title="No services yet"
              description="Start with GST filing, bookkeeping, payroll, TDS filing, ROC filings, audit support, or advisory services."
            />
          )}
        </CardContent>
      </Card>
      <ServiceBlueprintEditor
        service={blueprintService}
        onOpenChange={(open) => !open && setBlueprintService(null)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["tenant-admin-services"] });
          void queryClient.invalidateQueries({ queryKey: ["tenant-admin-task-options"] });
        }}
      />
      <ServiceTaskDetailsDrawer target={detailsTarget} onClose={() => setDetailsTarget(null)} />
    </div>
  );
}

function ServiceHierarchyList({
  services,
  expandedServiceIds,
  updatingServiceId,
  updatingRateItemId,
  onToggleExpanded,
  onManageService,
  onShowDetails,
  onSetServiceStatus,
  onSetTaskStatus,
}: {
  services: readonly TenantAdminService[];
  expandedServiceIds: ReadonlySet<string>;
  updatingServiceId: string | null;
  updatingRateItemId: string | null;
  onToggleExpanded: (serviceId: string) => void;
  onManageService: (service: { id: string; name: string }) => void;
  onShowDetails: (target: ServiceDetailsTarget) => void;
  onSetServiceStatus: (serviceId: string, status: "active" | "inactive") => Promise<void>;
  onSetTaskStatus: (serviceId: string, rateItemId: string, status: "active" | "inactive") => Promise<void>;
}) {
  return (
    <div className="divide-y rounded-[var(--radius-card)] border">
      {services.map((service) => (
        <ServiceHierarchyRow
          key={service.id}
          service={service}
          expanded={expandedServiceIds.has(service.id)}
          updatingServiceId={updatingServiceId}
          updatingRateItemId={updatingRateItemId}
          onToggleExpanded={() => onToggleExpanded(service.id)}
          onManageService={() => onManageService({ id: service.id, name: service.name })}
          onShowDetails={onShowDetails}
          onSetServiceStatus={onSetServiceStatus}
          onSetTaskStatus={onSetTaskStatus}
        />
      ))}
    </div>
  );
}

function ServiceHierarchyRow({
  service,
  expanded,
  updatingServiceId,
  updatingRateItemId,
  onToggleExpanded,
  onManageService,
  onShowDetails,
  onSetServiceStatus,
  onSetTaskStatus,
}: {
  service: TenantAdminService;
  expanded: boolean;
  updatingServiceId: string | null;
  updatingRateItemId: string | null;
  onToggleExpanded: () => void;
  onManageService: () => void;
  onShowDetails: (target: ServiceDetailsTarget) => void;
  onSetServiceStatus: (serviceId: string, status: "active" | "inactive") => Promise<void>;
  onSetTaskStatus: (serviceId: string, rateItemId: string, status: "active" | "inactive") => Promise<void>;
}) {
  const tenantRates = tenantDefaultRates(service);
  const taskCount = tenantRates.length;
  const visibleRates = tenantRates.length ? tenantRates : service.rates;
  const inlineRates = visibleRates.slice(0, MAX_INLINE_TASKS);
  const hiddenRateCount = Math.max(visibleRates.length - inlineRates.length, 0);

  return (
    <section aria-label={`${service.name} service`}>
      <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <button
          type="button"
          className="flex min-w-0 items-start gap-2 text-left"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium">{service.name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{serviceSubtitle(service)}</span>
          </span>
        </button>

        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Badge tone="neutral">{taskCount} task{taskCount === 1 ? "" : "s"}</Badge>
          <ServiceStatusPill status={service.status} />
        </div>

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-auto sm:row-start-auto">
          <div className="flex flex-wrap items-center justify-end gap-2 sm:hidden">
            <Badge tone="neutral">{taskCount} task{taskCount === 1 ? "" : "s"}</Badge>
            <ServiceStatusPill status={service.status} />
          </div>
          <ServiceActionsMenu
            serviceName={service.name}
            status={service.status}
            disabled={updatingServiceId === service.id}
            onManageService={onManageService}
            onShowDetails={() =>
              onShowDetails({
                serviceId: service.id,
                serviceName: service.name,
              })
            }
            onToggleStatus={() =>
              void onSetServiceStatus(service.id, service.status === "active" ? "inactive" : "active")
            }
          />
        </div>
      </div>

      {expanded ? (
        <div className="border-t bg-muted/20 px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pl-6 sm:pl-8">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="neutral">{taskCount} task{taskCount === 1 ? "" : "s"}</Badge>
              <ServiceStatusPill status={service.status} />
            </div>
          </div>

          <div className="overflow-x-auto pl-6 sm:pl-8">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Task</th>
                  <th className="py-2 pr-4 text-right font-medium">Rate</th>
                  <th className="py-2 pr-4 font-medium">Unit</th>
                  <th className="hidden py-2 pr-4 font-medium md:table-cell">Scope</th>
                  <th className="py-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {inlineRates.length ? (
                  inlineRates.map((rate) => (
                    <TaskRateRow
                      key={rate.id}
                      serviceId={service.id}
                      rate={rate}
                      updatingRateItemId={updatingRateItemId}
                      onManageService={onManageService}
                      onShowDetails={() =>
                        onShowDetails({
                          serviceId: service.id,
                          serviceName: service.name,
                          rateItemId: rate.id,
                          taskType: rate.taskType,
                        })
                      }
                      onSetTaskStatus={onSetTaskStatus}
                    />
                  ))
                ) : (
                  <tr>
                    <td className="py-3 pr-4 text-muted-foreground" colSpan={5}>
                      No tasks configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hiddenRateCount > 0 ? (
            <div className="mt-3 pl-6 sm:pl-8">
              <Button type="button" variant="ghost" className="h-auto px-0 text-sm text-primary" onClick={onManageService}>
                View all {visibleRates.length} tasks →
              </Button>
            </div>
          ) : null}

          <div className="mt-3 pl-6 sm:pl-8">
            <Button type="button" size="sm" variant="outline" onClick={onManageService}>
              <Plus data-icon="inline-start" />
              Add task
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TaskRateRow({
  serviceId,
  rate,
  updatingRateItemId,
  onManageService,
  onShowDetails,
  onSetTaskStatus,
}: {
  serviceId: string;
  rate: TenantAdminServiceRate;
  updatingRateItemId: string | null;
  onManageService: () => void;
  onShowDetails: () => void;
  onSetTaskStatus: (serviceId: string, rateItemId: string, status: "active" | "inactive") => Promise<void>;
}) {
  const canToggleTask = !rate.clientName;

  return (
    <tr className="min-h-12">
      <td className="py-2.5 pr-4 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-medium", rate.status === "inactive" && "text-muted-foreground")}>
            {rate.taskType}
          </span>
          {rate.status === "inactive" ? <Badge tone="neutral">Disabled</Badge> : null}
        </div>
      </td>
      <td className="py-2.5 pr-4 text-right align-middle font-medium tabular-nums">
        {formatIndianMoney(rate.rateAmount, rate.currencyCode)}
        {rate.taxCode ? <span className="ml-1 block text-xs font-normal text-muted-foreground">+ {rate.taxCode}</span> : null}
      </td>
      <td className="py-2.5 pr-4 align-middle">
        <Badge tone="neutral">{billingUnitLabel(rate.unitType)}</Badge>
      </td>
      <td className="hidden py-2.5 pr-4 align-middle md:table-cell">
        <Badge tone="neutral">{rate.clientName ?? "Tenant default"}</Badge>
      </td>
      <td className="py-2.5 text-right align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="px-1.5"
              aria-label={`Task actions for ${rate.taskType}`}
              disabled={updatingRateItemId === rate.id}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onManageService}>Manage task</DropdownMenuItem>
            <DropdownMenuItem onSelect={onShowDetails}>Details</DropdownMenuItem>
            {canToggleTask ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={updatingRateItemId === rate.id}
                  onSelect={() =>
                    void onSetTaskStatus(serviceId, rate.id, rate.status === "active" ? "inactive" : "active")
                  }
                >
                  {rate.status === "active" ? "Disable task" : "Enable task"}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function ServiceActionsMenu({
  serviceName,
  status,
  disabled,
  onManageService,
  onShowDetails,
  onToggleStatus,
}: {
  serviceName: string;
  status: TenantAdminService["status"];
  disabled: boolean;
  onManageService: () => void;
  onShowDetails: () => void;
  onToggleStatus: () => void;
}) {
  const canToggle = status === "active" || status === "inactive";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="px-1.5"
          aria-label={`Actions for ${serviceName}`}
          disabled={disabled}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onManageService}>Manage tasks</DropdownMenuItem>
        <DropdownMenuItem onSelect={onShowDetails}>Details</DropdownMenuItem>
        {canToggle ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={disabled} onSelect={onToggleStatus}>
              {status === "active" ? "Disable service" : "Enable service"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ServiceTaskDetailsDrawer({
  target,
  onClose,
}: {
  target: ServiceDetailsTarget | null;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["tenant-admin-service-allocations", target?.serviceId, target?.rateItemId ?? "all"],
    queryFn: () => getTenantAdminServiceAllocations(target!.serviceId, target?.rateItemId),
    enabled: Boolean(target),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={target?.taskType ? `${target.taskType} details` : "Service task details"}
        description="Clients and employees allocated to operational tasks using this service rate."
        className="left-auto right-0 top-0 h-full max-h-none w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none"
      >
        {target ? (
          <div className="pr-8">
            <p className="text-sm font-medium text-primary">{target.serviceName}</p>
            <h2 className="mt-1 text-xl font-semibold">
              {target.taskType ? target.taskType : "All service tasks"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Operational tasks linked to this service rate and their assigned employees.
            </p>

            {query.isPending ? <div className="mt-6"><LoadingState label="Loading task allocations" rows={4} /></div> : null}
            {query.isError ? (
              <div className="mt-6">
                <ErrorState title="Task details could not load" onRetry={() => void query.refetch()} />
              </div>
            ) : null}
            {query.data ? <ServiceAllocationsPanel data={query.data} focusTaskType={target.taskType} /> : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ServiceAllocationsPanel({
  data,
  focusTaskType,
}: {
  data: TenantAdminServiceAllocations;
  focusTaskType?: string;
}) {
  const rateItems = focusTaskType
    ? data.rateItems.filter((item) => item.taskType.toLowerCase() === focusTaskType.toLowerCase())
    : data.rateItems;

  if (!rateItems.length) {
    return (
      <EmptyState
        title="No task allocations yet"
        description="Operational tasks created from this service rate will appear here with their client and employee assignments."
      />
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {rateItems.map((rateItem) => (
        <section key={rateItem.rateItemId} className="rounded-[var(--radius-card)] border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{rateItem.taskType}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatIndianMoney(rateItem.rateAmount, rateItem.currencyCode)} · {billingUnitLabel(rateItem.unitType)}
              </p>
            </div>
            <Badge tone="neutral">{rateItem.tasks.length} allocation{rateItem.tasks.length === 1 ? "" : "s"}</Badge>
          </div>

          {rateItem.tasks.length ? (
            <ul className="mt-4 flex flex-col divide-y">
              {rateItem.tasks.map((task) => (
                <li key={task.taskId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{task.taskTitle}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Client: {task.clientName}</p>
                    </div>
                    <StatusBadge status={mapTaskAllocationStatus(task.taskStatus)} />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employees</p>
                    {task.employees.length ? (
                      <ul className="mt-2 flex flex-col gap-2">
                        {task.employees.map((employee) => (
                          <li
                            key={`${task.taskId}-${employee.employeeId}`}
                            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                          >
                            <span>{employee.employeeName}</span>
                            <Badge tone="neutral" className="capitalize">
                              {employee.assignmentStatus.replaceAll("_", " ")}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">No employees assigned yet.</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No operational tasks are linked to this rate yet.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function mapTaskAllocationStatus(status: string): "pending" | "on-track" | "complete" | "at-risk" | "blocked" {
  if (status === "completed" || status === "approved") return "complete";
  if (status === "cancelled" || status === "returned") return "at-risk";
  if (status === "draft" || status === "requested") return "pending";
  if (status === "in_progress" || status === "assigned" || status === "open") return "on-track";
  return "pending";
}

function ServiceStatusPill({ status }: { status: TenantAdminService["status"] }) {
  const tone =
    status === "active" ? "success" : status === "inactive" ? "warning" : "neutral";
  return (
    <Badge tone={tone} className="capitalize">
      {status}
    </Badge>
  );
}

export function NewServiceDialog({
  onCreated,
  onCreatedService,
  triggerLabel = "Create service",
  triggerSize,
}: {
  onCreated?: () => void;
  onCreatedService?: (service: TenantAdminService) => void | Promise<void>;
  triggerLabel?: string;
  triggerSize?: "default" | "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(serviceInput);
  const [isSaving, setIsSaving] = useState(false);
  const amount = Number(input.rateAmount);
  const canSave = input.name.trim().length >= 2 && input.taskType.trim().length >= 2 && Number.isFinite(amount) && amount >= 0;
  const isDirty =
    input.name.trim().length > 0 ||
    input.taskType.trim().length > 0 ||
    input.rateAmount.trim().length > 0 ||
    input.taxCode.trim().length > 0 ||
    input.unitType !== serviceInput.unitType ||
    input.currencyCode !== serviceInput.currencyCode ||
    input.effectiveFrom !== serviceInput.effectiveFrom;

  const closeDialog = () => {
    setInput(serviceInput);
    setOpen(false);
  };

  const submit = async () => {
    setIsSaving(true);
    try {
      const service = await createTenantAdminService({
        ...input,
        name: input.name.trim(),
        taskType: input.taskType.trim(),
        rateAmount: amount,
        taxCode: input.taxCode.trim() || undefined,
      });
      toast.success("Service created.");
      setInput(serviceInput);
      setOpen(false);
      await onCreatedService?.(service);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Service could not be created.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setInput(serviceInput);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size={triggerSize}>
          <Plus data-icon="inline-start" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Create service"
        description="Create a reusable tenant service and default rate."
        blockOutsideClose={isDirty}
      >
        <div>
          <h2 className="text-lg font-semibold">Create service</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">
              Service name
              <Input className="mt-1" value={input.name} onChange={(event) => setInput((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="text-sm font-medium">
              Task type
              <Input className="mt-1" value={input.taskType} onChange={(event) => setInput((current) => ({ ...current, taskType: event.target.value }))} />
            </label>
            <label className="text-sm font-medium">
              Billing unit
              <Select className="mt-1" value={input.unitType} onChange={(event) => setInput((current) => ({ ...current, unitType: event.target.value as CreateTenantAdminServiceInput["unitType"] }))}>
                <option value="per_task">Per task</option>
                <option value="per_hour">Per hour</option>
                <option value="per_filing">Per filing</option>
                <option value="per_unit">Per unit</option>
              </Select>
            </label>
            <label className="text-sm font-medium">
              Rate
              <Input className="mt-1" min="0" step="0.01" type="number" value={input.rateAmount} onChange={(event) => setInput((current) => ({ ...current, rateAmount: event.target.value }))} />
            </label>
            <label className="text-sm font-medium">
              Currency
              <Select className="mt-1" value={input.currencyCode} onChange={(event) => setInput((current) => ({ ...current, currencyCode: event.target.value as CreateTenantAdminServiceInput["currencyCode"] }))}>
                <option value="INR">INR - Rupees</option>
                <option value="USD">USD - Dollar</option>
                <option value="GBP">GBP - Pound</option>
              </Select>
            </label>
            <label className="text-sm font-medium">
              Tax code
              <Input className="mt-1" value={input.taxCode} onChange={(event) => setInput((current) => ({ ...current, taxCode: event.target.value }))} />
            </label>
            <label className="text-sm font-medium">
              Effective from
              <DatePicker className="mt-1" value={input.effectiveFrom} onChange={(value) => setInput((current) => ({ ...current, effectiveFrom: value }))} aria-label="Effective from" />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button type="button" disabled={isSaving || !canSave} onClick={() => void submit()}>
              {isSaving ? "Saving..." : "Save service"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function tenantDefaultRates(service: TenantAdminService) {
  return service.rates.filter((rate) => !rate.clientName);
}

function serviceSubtitle(service: TenantAdminService) {
  return service.code
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatIndianMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function billingUnitLabel(unit: string) {
  const words = unit.replace(/^per_/, "").replace(/_/g, " ");
  return `Per ${words}`;
}
