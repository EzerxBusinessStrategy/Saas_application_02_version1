"use client";

import { useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClientServiceCustomizer, type ClientServiceDraftTask } from "@/components/tenant-administration/client-service-customizer";
import { ServiceEmployeeSelector } from "@/components/tenant-administration/service-employee-selector";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  activateClientServices,
  estimatedServiceTotal,
  getClientServiceOnboardingCatalog,
  listClientServiceOnboardingAssignees,
  type ServiceBlueprintDueRule,
  type ServiceOnboardingCatalogItem,
} from "@/features/administration/api/service-onboarding-api";

type Step = 1 | 2 | 3 | 4;

type DraftService = {
  serviceId: string;
  name: string;
  currencyCode: string;
  alreadyActive: boolean;
  tasks: ClientServiceDraftTask[];
  assignedEmployeeId: string;
};

const stepLabel: Record<Step, string> = {
  1: "Select services",
  2: "Customize package",
  3: "Assign responsible person",
  4: "Review and activate",
};

export function ClientServiceOnboarding({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftService>>({});
  const [activating, setActivating] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ["client-service-onboarding-catalog", clientId],
    queryFn: () => getClientServiceOnboardingCatalog(clientId),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setIdempotencyKey(crypto.randomUUID());
    setSelectedIds([]);
    setDrafts(
      catalogQuery.data
        ? Object.fromEntries(catalogQuery.data.services.map((item) => [item.serviceId, catalogItemToDraft(item)]))
        : {},
    );
    // Catalog data is applied on open; later loads fill empty drafts in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the wizard opens
  }, [open, clientId]);

  useEffect(() => {
    if (!open || !catalogQuery.data) return;
    setDrafts((current) => {
      if (Object.keys(current).length > 0) return current;
      return Object.fromEntries(catalogQuery.data.services.map((item) => [item.serviceId, catalogItemToDraft(item)]));
    });
  }, [open, catalogQuery.data]);

  const selected = selectedIds.map((id) => drafts[id]).filter(Boolean);
  const assigneeQueries = useQueries({
    queries: selected.map((service) => ({
      queryKey: ["client-service-onboarding-assignees", clientId, service.serviceId],
      queryFn: () => listClientServiceOnboardingAssignees(clientId, service.serviceId),
      enabled: open && step >= 3,
    })),
  });

  const estimatedTotal = selected.reduce((sum, service) => sum + estimatedServiceTotal(service.tasks), 0);
  const currencyCode = selected[0]?.currencyCode ?? catalogQuery.data?.services[0]?.currencyCode ?? "INR";
  const canContinueFromSelect = selectedIds.length > 0;
  const canContinueFromCustomize = selected.every((service) => service.tasks.some((task) => task.enabled));
  const canContinueFromAssign = selected.every((service) => service.assignedEmployeeId);
  const canActivate = canContinueFromSelect && canContinueFromCustomize && canContinueFromAssign && !activating;

  const toggleService = (serviceId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, serviceId])] : current.filter((id) => id !== serviceId),
    );
  };

  const activate = async () => {
    if (!canActivate) return;
    setActivating(true);
    try {
      const result = await activateClientServices(clientId, {
        idempotencyKey,
        countryCode: "IN",
        currencyCode: currencyCode === "USD" || currencyCode === "GBP" ? currencyCode : "INR",
        services: selected.map((service) => ({
          serviceId: service.serviceId,
          assignedEmployeeId: service.assignedEmployeeId,
          tasks: service.tasks.map((task) => ({
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-admin-services"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-admin-task-options"] }),
        queryClient.invalidateQueries({ queryKey: ["client-portal-dashboard"] }),
      ]);
      toast.success(
        result.replayed
          ? "These services were already activated."
          : `${result.services.length} service${result.services.length === 1 ? "" : "s"} activated.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Services could not be activated.");
    } finally {
      setActivating(false);
    }
  };

  const continueLabel = step === 4 ? (activating ? "Activating..." : "Activate services") : "Continue";
  const canContinue =
    step === 1 ? canContinueFromSelect : step === 2 ? canContinueFromCustomize : step === 3 ? canContinueFromAssign : canActivate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Configure services for ${clientName}`}
        description="Select services, customize the booklet for this client, assign a responsible employee, then activate to generate tasks."
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        <div>
          <h2 className="text-lg font-semibold">Configure services</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {clientName} · Step {step} of 4 · {stepLabel[step]}
          </p>
          <div className="mt-5">
            {step === 1 ? (
              <SelectServicesStep
                isPending={catalogQuery.isPending}
                isError={catalogQuery.isError}
                services={catalogQuery.data?.services ?? []}
                selectedIds={selectedIds}
                onToggle={toggleService}
              />
            ) : null}
            {step === 2 ? (
              <div className="flex flex-col gap-4">
                {selected.map((service) => (
                  <ClientServiceCustomizer
                    key={service.serviceId}
                    serviceName={service.name}
                    currencyCode={service.currencyCode}
                    tasks={service.tasks}
                    onChange={(tasks) =>
                      setDrafts((current) => ({
                        ...current,
                        [service.serviceId]: { ...service, tasks },
                      }))
                    }
                  />
                ))}
              </div>
            ) : null}
            {step === 3 ? (
              <div className="flex flex-col gap-4">
                {selected.map((service, index) => (
                  <ServiceEmployeeSelector
                    key={service.serviceId}
                    serviceName={service.name}
                    employees={assigneeQueries[index]?.data ?? []}
                    isLoading={assigneeQueries[index]?.isPending ?? false}
                    value={service.assignedEmployeeId}
                    onChange={(assignedEmployeeId) =>
                      setDrafts((current) => ({
                        ...current,
                        [service.serviceId]: { ...service, assignedEmployeeId },
                      }))
                    }
                  />
                ))}
              </div>
            ) : null}
            {step === 4 ? (
              <ReviewStep
                clientName={clientName}
                services={selected}
                estimatedTotal={estimatedTotal}
                currencyCode={currencyCode}
                assigneeNames={Object.fromEntries(
                  selected.map((service, index) => [
                    service.serviceId,
                    (assigneeQueries[index]?.data ?? []).find((employee) => employee.employeeId === service.assignedEmployeeId)?.name ??
                      "Assigned",
                  ]),
                )}
              />
            ) : null}
          </div>
          <div className="mt-6 flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1 || activating}
              onClick={() => setStep((current) => (current === 1 ? 1 : ((current - 1) as Step)))}
            >
              Back
            </Button>
            <Button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                if (step < 4) {
                  setStep((current) => ((current + 1) as Step));
                  return;
                }
                void activate();
              }}
            >
              {continueLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectServicesStep({
  isPending,
  isError,
  services,
  selectedIds,
  onToggle,
}: {
  isPending: boolean;
  isError: boolean;
  services: readonly ServiceOnboardingCatalogItem[];
  selectedIds: readonly string[];
  onToggle: (serviceId: string, checked: boolean) => void;
}) {
  if (isPending) return <p className="text-sm text-muted-foreground">Loading services…</p>;
  if (isError) return <p className="text-sm text-destructive">Services could not load.</p>;
  if (!services.length) {
    return (
      <EmptyState
        title="No service booklets yet"
        description="Add tasks to a service first, then return here to configure this client."
      />
    );
  }
  return (
    <fieldset>
      <legend className="text-sm font-medium">Select services</legend>
      <ul className="mt-3 flex flex-col divide-y rounded-[var(--radius-control)] border">
        {services.map((service) => (
          <li key={service.serviceId} className="flex items-start gap-3 p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={selectedIds.includes(service.serviceId)}
              disabled={service.alreadyActive}
              aria-label={service.name}
              onChange={(event) => onToggle(service.serviceId, event.target.checked)}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{service.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {service.tasks.length} tasks · {formatMoney(service.estimatedAnnualTotal, service.currencyCode)}
                {service.alreadyActive ? " · already active" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function ReviewStep({
  clientName,
  services,
  estimatedTotal,
  currencyCode,
  assigneeNames,
}: {
  clientName: string;
  services: readonly DraftService[];
  estimatedTotal: number;
  currencyCode: string;
  assigneeNames: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {clientName} · {services.length} service{services.length === 1 ? "" : "s"}. Tasks are created only after you activate.
      </p>
      {services.map((service) => {
        const enabledCount = service.tasks.filter((task) => task.enabled).length;
        return (
          <article key={service.serviceId} className="rounded-[var(--radius-control)] border p-4">
            <h3 className="font-medium">{service.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Responsible: {assigneeNames[service.serviceId] ?? "Assigned"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {enabledCount} recurring task{enabledCount === 1 ? "" : "s"} · {formatMoney(estimatedServiceTotal(service.tasks), service.currencyCode)}
            </p>
          </article>
        );
      })}
      <p className="text-sm font-medium">Estimated total {formatMoney(estimatedTotal, currencyCode)}</p>
    </div>
  );
}

function catalogItemToDraft(item: ServiceOnboardingCatalogItem): DraftService {
  return {
    serviceId: item.serviceId,
    name: item.name,
    currencyCode: item.currencyCode,
    alreadyActive: item.alreadyActive,
    assignedEmployeeId: "",
    tasks: item.tasks.map((task) => ({
      taskType: task.taskType,
      title: task.taskType,
      frequency: task.frequency,
      dueRule: task.dueRule as ServiceBlueprintDueRule,
      unitType: task.unitType,
      rateAmount: task.rateAmount,
      taxCode: task.taxCode ?? "",
      enabled: true,
    })),
  };
}

function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
