"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createTenantAdminService,
  listTenantAdminServices,
  type CreateTenantAdminServiceInput,
  type TenantAdminService,
} from "@/features/operations/api/operations-api";
import { ServiceBlueprintEditor } from "@/components/tenant-administration/service-blueprint-editor";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
  const query = useQuery({
    queryKey: ["tenant-admin-services"],
    queryFn: listTenantAdminServices,
  });

  if (query.isPending) return <LoadingState label="Loading services and rates" rows={5} />;
  if (query.isError) return <ErrorState title="Services could not load" onRetry={() => void query.refetch()} />;

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Services"
        description="Manage tenant services and reusable rate-card prices used when creating client tasks."
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
        <CardHeader>
          <CardTitle>Service rate list</CardTitle>
        </CardHeader>
        <CardContent>
          {query.data.length ? <ServiceTable services={query.data} onManageTasks={setBlueprintService} /> : (
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
    </div>
  );
}

function ServiceTable({
  services,
  onManageTasks,
}: {
  services: readonly TenantAdminService[];
  onManageTasks: (service: { id: string; name: string }) => void;
}) {
  return (
    <div className="overflow-x-auto border">
      <table className="min-w-full divide-y text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Service</th>
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Rate</th>
            <th className="px-4 py-3 font-medium">Scope</th>
            <th className="px-4 py-3 font-medium">Unit</th>
            <th className="px-4 py-3 font-medium">In use</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {services.map((service) => {
            const rates = service.rates.length ? service.rates : [null];
            return rates.map((rate, index) => (
              <tr key={rate?.id ?? `${service.id}-${index}`}>
                {index === 0 ? (
                  <td className="px-4 py-3 align-top" rowSpan={rates.length}>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{service.code}</p>
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <p className="font-medium">{rate?.taskType?.trim() || "No task"}</p>
                </td>
                <td className="px-4 py-3 font-medium">
                  {rate ? formatMoney(rate.rateAmount, rate.currencyCode) : "No rate"}
                  {rate?.taxCode ? <span className="ml-1 text-xs text-muted-foreground">+ {rate.taxCode}</span> : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{rate?.clientName ?? "Tenant default"}</td>
                <td className="px-4 py-3">{rate ? billingUnitLabel(rate.unitType) : "-"}</td>
                <td className="px-4 py-3">{rate?.tasksUsingRate ?? 0}</td>
                {index === 0 ? (
                  <td className="px-4 py-3 align-top capitalize" rowSpan={rates.length}>
                    {service.status}
                  </td>
                ) : null}
                {index === 0 ? (
                  <td className="px-4 py-3 align-top" rowSpan={rates.length}>
                    <Button type="button" size="sm" variant="outline" onClick={() => onManageTasks({ id: service.id, name: service.name })}>
                      Manage tasks
                    </Button>
                  </td>
                ) : null}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size={triggerSize}>
          <Plus data-icon="inline-start" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent title="Create service" description="Create a reusable tenant service and default rate.">
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
              <Input className="mt-1" type="date" value={input.effectiveFrom} onChange={(event) => setInput((current) => ({ ...current, effectiveFrom: event.target.value }))} />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={isSaving || !canSave} onClick={() => void submit()}>
              {isSaving ? "Saving..." : "Save service"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function billingUnitLabel(unit: string) {
  return unit.replace("per_", "per ");
}
